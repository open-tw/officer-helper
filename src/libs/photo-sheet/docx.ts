import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx'
import { paginatePhotos, validateSheet } from './model.ts'
import { browserDrawing } from './render.ts'
import {
  DOCUMENT_IMAGE_WIDTH,
  documentImageHeight,
  documentPhotoBytes,
} from './document-photo.ts'
import type { PhotoSheet } from './model.ts'
import type { DrawingRuntime } from './render.ts'
import type { ExportOptions, PhotoSheetExporter } from './export.ts'

const FONT = 'Noto Sans CJK TC'
const cmToTwip = (cm: number) => Math.round((cm * 1440) / 2.54)
const cmToPixel = (cm: number) => (cm * 96) / 2.54
const border = { style: BorderStyle.SINGLE, size: 4, color: '8B939B' }
const cellWidth = cmToTwip(9)

export async function exportPhotoSheetDocx(
  sheet: PhotoSheet,
  options: ExportOptions = {},
  runtime: DrawingRuntime = browserDrawing,
) {
  validateSheet(sheet)
  options.signal?.throwIfAborted()
  const children: (Paragraph | Table)[] = []
  const pages = paginatePhotos(sheet)
  const height = documentImageHeight(sheet)
  for (const [pageIndex, photos] of pages.entries()) {
    options.signal?.throwIfAborted()
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: sheet.title.trim() || '照片佐證表',
            bold: true,
            size: 36,
          }),
        ],
        pageBreakBefore: pageIndex > 0,
        keepNext: true,
        spacing: { before: 0, after: 120 },
      }),
    )
    if (sheet.subject.trim())
      children.push(
        new Paragraph({
          text: `案件／活動：${sheet.subject}`,
          keepNext: true,
          spacing: { after: 80 },
        }),
      )
    if (sheet.date)
      children.push(
        new Paragraph({
          text: `日期：${sheet.date}`,
          keepNext: true,
          spacing: { after: 120 },
        }),
      )
    const cells: TableCell[] = []
    for (const [index, photo] of photos.entries()) {
      const image = await documentPhotoBytes(
        photo,
        height,
        runtime,
        options.signal,
      )
      cells.push(
        new TableCell({
          width: { size: cellWidth, type: WidthType.DXA },
          verticalAlign: VerticalAlign.TOP,
          margins: {
            top: cmToTwip(0.2),
            bottom: cmToTwip(0.2),
            left: cmToTwip(0.2),
            right: cmToTwip(0.2),
          },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              keepNext: true,
              spacing: { before: 0, after: 60 },
              children: [
                new ImageRun({
                  type: image.type,
                  data: image.bytes,
                  transformation: {
                    width: cmToPixel(DOCUMENT_IMAGE_WIDTH),
                    height: cmToPixel(height),
                  },
                  altText: {
                    title: photo.name,
                    description: photo.caption || photo.name,
                    name: `照片 ${pageIndex * sheet.photosPerPage + index + 1}`,
                  },
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `照片 ${pageIndex * sheet.photosPerPage + index + 1}`,
                  bold: true,
                }),
              ],
              keepNext: true,
              spacing: { after: 40 },
            }),
            new Paragraph({
              text: photo.caption.replace(/\s+/g, ' ').trim(),
              spacing: { after: 0 },
              keepNext: false,
            }),
          ],
        }),
      )
    }
    if (cells.length % 2)
      cells.push(
        new TableCell({
          width: { size: cellWidth, type: WidthType.DXA },
          children: [new Paragraph('')],
        }),
      )
    const rows: TableRow[] = []
    for (let index = 0; index < cells.length; index += 2)
      rows.push(
        new TableRow({
          children: cells.slice(index, index + 2),
          cantSplit: true,
        }),
      )
    children.push(
      new Table({
        rows,
        layout: TableLayoutType.FIXED,
        width: { size: cellWidth * 2, type: WidthType.DXA },
        columnWidths: [cellWidth, cellWidth],
        borders: {
          top: border,
          bottom: border,
          left: border,
          right: border,
          insideHorizontal: border,
          insideVertical: border,
        },
      }),
    )
    options.onProgress?.(pageIndex + 1, pages.length)
  }
  const document = new Document({
    title: sheet.title || '照片佐證表',
    subject: sheet.subject,
    styles: {
      default: {
        document: {
          run: {
            font: { ascii: FONT, hAnsi: FONT, eastAsia: FONT, cs: FONT },
            size: 20,
            sizeComplexScript: 20,
            color: '17212B',
            language: { value: 'zh-TW', eastAsia: 'zh-TW' },
          },
          paragraph: { spacing: { before: 0, after: 0, line: 276 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: cmToTwip(21), height: cmToTwip(29.7) },
            margin: {
              top: cmToTwip(1.5),
              bottom: cmToTwip(1.5),
              left: cmToTwip(1.5),
              right: cmToTwip(1.5),
              footer: cmToTwip(0.7),
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    children: ['第 ', PageNumber.CURRENT, ' 頁'],
                    size: 18,
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  })
  options.signal?.throwIfAborted()
  const blob = await Packer.toBlob(document)
  options.signal?.throwIfAborted()
  return blob
}

export const docxExporter: PhotoSheetExporter = {
  format: 'docx',
  extension: 'docx',
  export: exportPhotoSheetDocx,
}
