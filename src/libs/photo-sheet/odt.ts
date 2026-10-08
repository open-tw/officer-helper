import { OdtDocument } from 'odf-kit'
import {
  BlobReader,
  BlobWriter,
  TextReader,
  TextWriter,
  ZipReader,
  ZipWriter,
} from '@zip.js/zip.js'
import { paginatePhotos, validateSheet } from './model.ts'
import { browserDrawing } from './render.ts'
import type { PhotoSheet } from './model.ts'
import type { DrawingRuntime } from './render.ts'
import type { ExportOptions, PhotoSheetExporter } from './export.ts'
import {
  DOCUMENT_IMAGE_WIDTH,
  documentImageHeight,
  documentPhotoBytes,
} from './document-photo.ts'

const MIME = 'application/vnd.oasis.opendocument.text'
const FONT = 'Noto Sans CJK TC'

/** odf-kit 0.14 has no row pagination option; add the standard ODF row style. */
async function keepPhotoRowsTogether(bytes: Uint8Array, signal?: AbortSignal) {
  const reader = new ZipReader(
    new BlobReader(new Blob([new Uint8Array(bytes)])),
  )
  const writer = new ZipWriter(new BlobWriter(MIME))
  try {
    const entries = await reader.getEntries()
    // ODF requires an uncompressed first mimetype entry without extra fields.
    await writer.add('mimetype', new TextReader(MIME), {
      level: 0,
      extendedTimestamp: false,
      extraField: new Map(),
      dataDescriptor: false,
    })
    for (const entry of entries) {
      signal?.throwIfAborted()
      if (entry.filename === 'mimetype' || entry.directory) continue
      if (entry.filename === 'content.xml') {
        const xml = await entry.getData(new TextWriter())
        const style =
          '<style:style style:name="PhotoSheetRow" style:family="table-row"><style:table-row-properties fo:keep-together="always"/></style:style>'
        const content = xml
          .replace(
            '</office:automatic-styles>',
            `${style}</office:automatic-styles>`,
          )
          .replace(
            /<table:table-row(?=[ >])/g,
            '<table:table-row table:style-name="PhotoSheetRow"',
          )
        await writer.add(entry.filename, new TextReader(content))
      } else {
        await writer.add(
          entry.filename,
          new BlobReader(await entry.getData(new BlobWriter())),
        )
      }
    }
    signal?.throwIfAborted()
    return await writer.close()
  } catch (error) {
    await writer.close().catch(() => {})
    throw error
  } finally {
    await reader.close()
  }
}

export async function exportPhotoSheetOdt(
  sheet: PhotoSheet,
  options: ExportOptions = {},
  runtime: DrawingRuntime = browserDrawing,
) {
  validateSheet(sheet)
  options.signal?.throwIfAborted()
  const document = new OdtDocument()
  document.setMetadata({
    title: sheet.title || '照片佐證表',
    description: sheet.subject,
  })
  document.setPageLayout({
    width: '21cm',
    height: '29.7cm',
    orientation: 'portrait',
    marginTop: '1.5cm',
    marginBottom: '1.5cm',
    marginLeft: '1.5cm',
    marginRight: '1.5cm',
  })
  document.setFooter((footer) => {
    const font = { fontFamily: FONT, fontSize: 9 }
    footer.addText('第 ', font).addPageNumber(font).addText(' 頁', font)
  })
  const pages = paginatePhotos(sheet)
  // Leave room for 80-character captions, two-line headers and font substitution.
  const height = documentImageHeight(sheet)
  for (const [pageIndex, photos] of pages.entries()) {
    options.signal?.throwIfAborted()
    if (pageIndex) document.addPageBreak()
    document.addParagraph(
      (p) =>
        p.addText(sheet.title.trim() || '照片佐證表', {
          fontFamily: FONT,
          fontSize: 18,
          bold: true,
        }),
      { spaceBefore: '0cm', spaceAfter: '0.2cm' },
    )
    if (sheet.subject.trim())
      document.addParagraph(
        (p) =>
          p.addText(`案件／活動：${sheet.subject}`, {
            fontFamily: FONT,
            fontSize: 10,
          }),
        { spaceAfter: '0.15cm' },
      )
    if (sheet.date)
      document.addParagraph(
        (p) =>
          p.addText(`日期：${sheet.date}`, { fontFamily: FONT, fontSize: 10 }),
        { spaceAfter: '0.2cm' },
      )
    const images: Awaited<ReturnType<typeof documentPhotoBytes>>[] = []
    for (const photo of photos)
      images.push(
        await documentPhotoBytes(photo, height, runtime, options.signal),
      )
    document.addTable(
      (table) => {
        for (let rowIndex = 0; rowIndex < photos.length; rowIndex += 2) {
          table.addRow((row) => {
            for (let column = 0; column < 2; column++) {
              const index = rowIndex + column
              const photo = photos.at(index)
              row.addCell(
                (cell) => {
                  if (!photo) return
                  cell.addImage(images[index].bytes, {
                    width: `${DOCUMENT_IMAGE_WIDTH}cm`,
                    height: `${height}cm`,
                    mimeType: images[index].mimeType,
                    anchor: 'as-character',
                    alt: photo.caption || photo.name,
                  })
                  cell.addLineBreak()
                  cell.addText(
                    `照片 ${pageIndex * sheet.photosPerPage + index + 1}`,
                    { bold: true },
                  )
                  cell.addLineBreak()
                  cell.addText(photo.caption.replace(/\s+/g, ' ').trim())
                },
                {
                  fontFamily: FONT,
                  fontSize: 10,
                  padding: '0.2cm',
                  verticalAlign: 'top',
                },
              )
            }
          })
        }
      },
      { columnWidths: ['9cm', '9cm'], border: '0.5pt solid #8b939b' },
    )
    options.onProgress?.(pageIndex + 1, pages.length)
  }
  options.signal?.throwIfAborted()
  return keepPhotoRowsTogether(await document.save(), options.signal)
}

export const odtExporter: PhotoSheetExporter = {
  format: 'odt',
  extension: 'odt',
  export: exportPhotoSheetOdt,
}
