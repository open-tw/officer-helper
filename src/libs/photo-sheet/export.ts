import { A4, paginatePhotos, validateSheet } from './model.ts'
import { canvasBlob, renderPhotoSheetPage } from './render.ts'
import type { PhotoSheet } from './model.ts'
import type { DrawingRuntime } from './render.ts'

export type ExportOptions = {
  signal?: AbortSignal
  onProgress?: (completed: number, total: number) => void
}

/** Shared contract for PDF, ODT and DOCX; document data stays format-neutral. */
export type PhotoSheetExporter = {
  format: 'pdf' | 'odt' | 'docx'
  extension: string
  export: (sheet: PhotoSheet, options?: ExportOptions) => Promise<Blob>
}

export async function exportPhotoSheetPdf(
  sheet: PhotoSheet,
  options: ExportOptions = {},
  runtime?: DrawingRuntime,
) {
  validateSheet(sheet)
  const { PDFDocument } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  pdf.setTitle(sheet.title || '照片佐證表')
  pdf.setSubject(sheet.subject)
  const pages = paginatePhotos(sheet)
  for (let index = 0; index < pages.length; index++) {
    options.signal?.throwIfAborted()
    const canvas = await renderPhotoSheetPage(sheet, index, {
      scale: 3,
      signal: options.signal,
      runtime,
    })
    try {
      // Rasterize at 216 dpi to preserve local CJK fonts without font downloads.
      const image = await pdf.embedJpg(
        await (await canvasBlob(canvas)).arrayBuffer(),
      )
      const page = pdf.addPage([A4.width, A4.height])
      page.drawImage(image, { x: 0, y: 0, width: A4.width, height: A4.height })
      options.onProgress?.(index + 1, pages.length)
    } finally {
      canvas.width = canvas.height = 0
    }
  }
  options.signal?.throwIfAborted()
  return new Blob([new Uint8Array(await pdf.save())], {
    type: 'application/pdf',
  })
}

export const pdfExporter: PhotoSheetExporter = {
  format: 'pdf',
  extension: 'pdf',
  export: exportPhotoSheetPdf,
}
