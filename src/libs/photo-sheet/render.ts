import {
  A4,
  imagePlacement,
  paginatePhotos,
  validateSheet,
  wrapText,
} from './model.ts'
import type { PhotoSheet, PhotoSheetPhoto } from './model.ts'

// Injectable drawing primitives let rendering tests exercise the actual layout.
export type DrawingRuntime = {
  canvas: () => HTMLCanvasElement
  decode: (blob: Blob) => Promise<{
    image: CanvasImageSource
    width: number
    height: number
    close: () => void
  }>
}
export const browserDrawing: DrawingRuntime = {
  canvas: () => document.createElement('canvas'),
  decode: async (blob) => {
    const bitmap = await createImageBitmap(blob, {
      imageOrientation: 'from-image',
    })
    return {
      image: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    }
  },
}
const FONT =
  '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", "Heiti TC", sans-serif'

/** Canvas/document exports preserve JPEG and PNG; other inputs use lossless PNG. */
export function photoOutputType(image: Blob, name = '') {
  return image.type === 'image/jpeg' || (!image.type && /\.jpe?g$/i.test(name))
    ? 'image/jpeg'
    : 'image/png'
}

export function canvasBlob(
  canvas: HTMLCanvasElement,
  type = 'image/jpeg',
  quality = 0.94,
): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error('無法產生圖片，請減少照片後再試。')),
      type,
      quality,
    ),
  )
}

/** Normalize orientation and bound memory while retaining print resolution. */
export async function preparePhoto(
  file: File,
  runtime: DrawingRuntime = browserDrawing,
): Promise<PhotoSheetPhoto> {
  if (/\.hei[cf]$/i.test(file.name) || /hei[cf]/i.test(file.type))
    throw new Error('請先將 HEIC／HEIF 轉為 JPG 或 PNG。')
  if (
    !/\.(jpe?g|png|webp|bmp)$/i.test(file.name) &&
    !/^image\/(jpeg|png|webp|bmp)$/.test(file.type)
  )
    throw new Error('支援 JPG、PNG、WebP 與 BMP 圖片。')
  const decoded = await runtime.decode(file)
  const canvas = runtime.canvas()
  const type = photoOutputType(file, file.name)
  try {
    const ratio = Math.min(1, 2400 / Math.max(decoded.width, decoded.height))
    canvas.width = Math.max(1, Math.round(decoded.width * ratio))
    canvas.height = Math.max(1, Math.round(decoded.height * ratio))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('瀏覽器無法處理圖片。')
    if (type === 'image/jpeg') {
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    ctx.drawImage(decoded.image, 0, 0, canvas.width, canvas.height)
    return {
      id: crypto.randomUUID(),
      name: file.name,
      image: await canvasBlob(canvas, type),
      caption: '',
      rotation: 0,
      fit: 'contain',
    }
  } finally {
    decoded.close()
    canvas.width = canvas.height = 0
  }
}

/** Identical geometry for live preview and PDF; all coordinates are PDF points. */
export async function renderPhotoSheetPage(
  sheet: PhotoSheet,
  pageIndex: number,
  options: {
    scale?: number
    signal?: AbortSignal
    runtime?: DrawingRuntime
  } = {},
) {
  validateSheet(sheet)
  const pages = paginatePhotos(sheet)
  const photos = pages.at(pageIndex)
  if (!photos) throw new Error('找不到預覽頁面。')
  const { scale = 1.5, signal, runtime = browserDrawing } = options
  signal?.throwIfAborted()
  const canvas = runtime.canvas()
  canvas.width = Math.ceil(A4.width * scale)
  canvas.height = Math.ceil(A4.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('瀏覽器無法產生預覽。')
  try {
    ctx.scale(scale, scale)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, A4.width, A4.height)
    ctx.textBaseline = 'top'
    ctx.fillStyle = '#17212b'
    const textLines = (
      text: string,
      size: number,
      width: number,
      bold = false,
    ) => {
      ctx.font = `${bold ? '600 ' : ''}${size}px ${FONT}`
      return wrapText(text, width, (value) => ctx.measureText(value).width)
    }
    const margin = 32
    const contentWidth = A4.width - margin * 2
    const title = textLines(sheet.title || '照片佐證表', 20, contentWidth, true)
    title.forEach((line, index) => ctx.fillText(line, margin, 30 + index * 25))
    let headerY = 30 + title.length * 25 + 10
    if (sheet.subject.trim()) {
      const subject = textLines(
        `案件／活動：${sheet.subject}`,
        11,
        contentWidth,
      )
      subject.forEach((line, index) =>
        ctx.fillText(line, margin, headerY + index * 16),
      )
      headerY += subject.length * 16 + 5
    }
    if (sheet.date) {
      ctx.font = `11px ${FONT}`
      ctx.fillText(`日期：${sheet.date}`, margin, headerY)
      headerY += 21
    }
    const tableTop = Math.max(116, headerY + 12)
    const rows = sheet.photosPerPage / 2
    const cellWidth = contentWidth / 2
    const cellHeight = (A4.height - 48 - tableTop) / rows
    for (let row = 0; row < rows; row++) {
      const rowPhotos = photos.slice(row * 2, row * 2 + 2)
      if (!rowPhotos.length) break
      const captions = rowPhotos.map((photo) =>
        textLines(photo.caption, 11, cellWidth - 20),
      )
      const captionHeight =
        25 + Math.max(1, ...captions.map((lines) => lines.length)) * 15
      const imageHeight = cellHeight - captionHeight - 20
      if (imageHeight < 35)
        throw new Error('文字太長，請縮短說明或減少每頁張數。')
      for (let column = 0; column < 2; column++) {
        const x = margin + column * cellWidth
        const y = tableTop + row * cellHeight
        ctx.strokeStyle = '#8b939b'
        ctx.lineWidth = 0.6
        ctx.strokeRect(x, y, cellWidth, cellHeight)
        const photo = rowPhotos.at(column)
        if (!photo) continue
        signal?.throwIfAborted()
        const decoded = await runtime.decode(photo.image)
        try {
          signal?.throwIfAborted()
          const boxWidth = cellWidth - 20
          const size = imagePlacement(
            decoded.width,
            decoded.height,
            boxWidth,
            imageHeight,
            photo.rotation,
            photo.fit,
          )
          ctx.save()
          ctx.beginPath()
          ctx.rect(x + 10, y + 10, boxWidth, imageHeight)
          ctx.clip()
          ctx.translate(x + cellWidth / 2, y + 10 + imageHeight / 2)
          ctx.rotate((photo.rotation * Math.PI) / 180)
          ctx.drawImage(
            decoded.image,
            -size.width / 2,
            -size.height / 2,
            size.width,
            size.height,
          )
          ctx.restore()
        } finally {
          decoded.close()
        }
        const captionY = y + 20 + imageHeight
        ctx.beginPath()
        ctx.moveTo(x, captionY - 5)
        ctx.lineTo(x + cellWidth, captionY - 5)
        ctx.stroke()
        ctx.font = `600 10px ${FONT}`
        ctx.fillStyle = '#52606d'
        ctx.fillText(
          `照片 ${pageIndex * sheet.photosPerPage + row * 2 + column + 1}`,
          x + 10,
          captionY,
        )
        ctx.font = `11px ${FONT}`
        ctx.fillStyle = '#17212b'
        captions[column].forEach((line, index) =>
          ctx.fillText(line, x + 10, captionY + 17 + index * 15),
        )
      }
    }
    ctx.font = `10px ${FONT}`
    ctx.fillStyle = '#52606d'
    ctx.textAlign = 'center'
    ctx.fillText(
      `第 ${pageIndex + 1} 頁／共 ${pages.length} 頁`,
      A4.width / 2,
      A4.height - 27,
    )
    signal?.throwIfAborted()
    return canvas
  } catch (error) {
    canvas.width = canvas.height = 0
    throw error
  }
}
