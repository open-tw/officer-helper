import { imagePlacement } from './model.ts'
import { canvasBlob } from './render.ts'
import type { PhotoSheetPhoto, PhotoSheet } from './model.ts'
import type { DrawingRuntime } from './render.ts'

export const DOCUMENT_IMAGE_WIDTH = 8.4
// Reserve space for editable captions and font substitution in office documents.
export const documentImageHeight = (sheet: PhotoSheet) =>
  ({ 2: 16, 4: 6.4, 6: 3.3 })[sheet.photosPerPage]

/** Bake only the photo's fit/rotation; captions and table remain editable. */
export async function documentPhotoBytes(
  photo: PhotoSheetPhoto,
  height: number,
  runtime: DrawingRuntime,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted()
  const decoded = await runtime.decode(photo.image)
  const canvas = runtime.canvas()
  try {
    signal?.throwIfAborted()
    canvas.width = Math.round(DOCUMENT_IMAGE_WIDTH * 100)
    canvas.height = Math.round(height * 100)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('瀏覽器無法處理照片。')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    const size = imagePlacement(
      decoded.width,
      decoded.height,
      canvas.width,
      canvas.height,
      photo.rotation,
      photo.fit,
    )
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.rotate((photo.rotation * Math.PI) / 180)
    ctx.drawImage(
      decoded.image,
      -size.width / 2,
      -size.height / 2,
      size.width,
      size.height,
    )
    const blob = await canvasBlob(canvas)
    signal?.throwIfAborted()
    return new Uint8Array(await blob.arrayBuffer())
  } finally {
    decoded.close()
    canvas.width = canvas.height = 0
  }
}
