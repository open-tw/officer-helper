import { BlobReader, BlobWriter, ZipReader } from '@zip.js/zip.js'

export type ExtractedImage = {
  id: string
  name: string
  blob: Blob
}

const IMAGE_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  emf: 'image/emf',
  wmf: 'image/wmf',
  avif: 'image/avif',
  heic: 'image/heic',
  heif: 'image/heif',
  ico: 'image/x-icon',
}

/** Read embedded image resources without rendering or recompressing them. */
export async function extractDocumentImages(
  file: File,
  signal?: AbortSignal,
): Promise<ExtractedImage[]> {
  const extension = file.name.split('.').pop()?.toLowerCase()
  const folder =
    extension === 'docx'
      ? 'word/media/'
      : extension === 'odt'
        ? 'Pictures/'
        : null
  if (!folder) throw new Error('請選擇 DOCX 或 ODT 文件。')
  signal?.throwIfAborted()
  const reader = new ZipReader(new BlobReader(file))
  try {
    const images: ExtractedImage[] = []
    for (const entry of await reader.getEntries()) {
      signal?.throwIfAborted()
      if (entry.directory || !entry.filename.startsWith(folder)) continue
      const name = entry.filename.slice(folder.length)
      const type = IMAGE_TYPES[name.split('.').pop()?.toLowerCase() ?? '']
      if (!type) continue
      const blob = await entry.getData(new BlobWriter(type), {
        signal,
        checkSignature: true,
      })
      images.push({ id: entry.filename, name, blob })
    }
    signal?.throwIfAborted()
    return images
  } finally {
    await reader.close()
  }
}
