import { BlobReader, BlobWriter, ZipWriter } from '@zip.js/zip.js'
import type { ExtractedImage } from './extract.ts'

export function downloadName(name: string) {
  const base = name.split(/[\\/]/).pop() ?? ''
  return (
    // Remove characters that are invalid in download filenames.
    // eslint-disable-next-line no-control-regex
    base.replace(/[<>:"|?*\x00-\x1f]/g, '_').replace(/[. ]+$/, '') || 'image'
  )
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = downloadName(name)
  document.body.appendChild(link)
  try {
    link.click()
  } finally {
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

export async function packImages(
  images: ExtractedImage[],
  signal?: AbortSignal,
) {
  if (!images.length) throw new Error('請先選擇圖片。')
  signal?.throwIfAborted()
  const writer = new ZipWriter(new BlobWriter('application/zip'))
  const names = new Set<string>()
  try {
    for (const image of images) {
      signal?.throwIfAborted()
      const original = downloadName(image.name)
      const dot = original.lastIndexOf('.')
      const base = dot > 0 ? original.slice(0, dot) : original
      const extension = dot > 0 ? original.slice(dot) : ''
      let name = original
      let suffix = 2
      while (names.has(name.toLowerCase()))
        name = `${base} (${suffix++})${extension}`
      names.add(name.toLowerCase())
      await writer.add(name, new BlobReader(image.blob), { level: 0, signal })
    }
    signal?.throwIfAborted()
    return await writer.close()
  } catch (error) {
    await writer.close().catch(() => {})
    throw error
  }
}
