import {
  PDFDocument,
  PDFDict,
  PDFName,
  clip,
  degrees,
  endPath,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
} from 'pdf-lib'
import type { PDFPage } from 'pdf-lib'
import { MM, getPosterLayout, getTileOrigin } from './poster-layout.ts'
import type {
  PosterAssembly,
  PosterCount,
  PosterPaper,
} from './poster-layout.ts'

export async function readPosterSource(data: ArrayBuffer) {
  try {
    const document = await PDFDocument.load(data)
    if (document.getPageCount() === 0) throw new Error('empty')
    return document
  } catch (error) {
    if (error instanceof Error && /encrypted/i.test(error.message)) {
      throw new Error('這份 PDF 有加密保護，請先另存為未加密的 PDF 再試一次。')
    }
    throw new Error('無法讀取這份 PDF，請確認檔案完整且為有效的 PDF。')
  }
}

export function getPageGeometry(page: PDFPage) {
  const media = page.getMediaBox()
  const crop = page.getCropBox()
  // Like a PDF viewer, display the intersection of CropBox and MediaBox.
  const left = Math.max(media.x, crop.x)
  const bottom = Math.max(media.y, crop.y)
  const right = Math.min(media.x + media.width, crop.x + crop.width)
  const top = Math.min(media.y + media.height, crop.y + crop.height)
  const width = right - left
  const height = top - bottom
  const rotation = ((page.getRotation().angle % 360) + 360) % 360
  if (
    rotation % 90 !== 0 ||
    ![width, height].every((n) => Number.isFinite(n) && n > 0)
  ) {
    throw new Error('這一頁的尺寸或旋轉設定不支援，請先另存為一般 PDF。')
  }
  return {
    left,
    bottom,
    right,
    top,
    width,
    height,
    rotation,
    displayWidth: rotation % 180 === 0 ? width : height,
    displayHeight: rotation % 180 === 0 ? height : width,
  }
}

export async function createPoster(
  source: PDFDocument,
  pageIndex: number,
  paper: PosterPaper,
  count: PosterCount,
  options: { assembly?: PosterAssembly; showMarks?: boolean } = {},
) {
  const original = source.getPage(pageIndex)
  // Page embedding does not carry annotations. Refuse rather than silently lose
  // form values, stamps or handwriting. Link annotations do not affect the art.
  const annotations = original.node.Annots()
  if (annotations) {
    for (let i = 0; i < annotations.size(); i++) {
      const annotation = source.context.lookup(annotations.get(i))
      if (
        !(annotation instanceof PDFDict) ||
        String(annotation.get(PDFName.of('Subtype'))) !== '/Link'
      ) {
        throw new Error(
          '這一頁含有表單或註記，請先將內容列印另存為一般 PDF，再製作海報。',
        )
      }
    }
  }
  const geometry = getPageGeometry(original)
  const layout = getPosterLayout(
    geometry.displayWidth,
    geometry.displayHeight,
    paper,
    count,
    options.assembly,
  )
  const output = await PDFDocument.create()
  output.setTitle('Poster')
  output.setCreator('辦公室小幫手')
  // A blank page has no content stream and cannot be embedded by pdf-lib.
  const embedded = original.node.Contents()
    ? await output.embedPage(original, geometry)
    : null
  const scale = layout.scale
  const margin = layout.margin
  const offsetX = (layout.posterWidth - layout.contentWidth) / 2
  const offsetY = (layout.posterHeight - layout.contentHeight) / 2

  for (let index = 0; index < count; index++) {
    const tile = getTileOrigin(layout, index)
    const page = output.addPage([layout.pageWidth, layout.pageHeight])
    let x = margin + offsetX - tile.x
    let y = margin + offsetY - tile.y
    // /Rotate is clockwise; drawPage rotations are counterclockwise.
    if (geometry.rotation === 90) y += geometry.width * scale
    if (geometry.rotation === 180) {
      x += geometry.width * scale
      y += geometry.height * scale
    }
    if (geometry.rotation === 270) x += geometry.height * scale
    page.pushOperators(
      pushGraphicsState(),
      rectangle(margin, margin, layout.tileWidth, layout.tileHeight),
      clip(),
      endPath(),
    )
    if (embedded) {
      page.drawPage(embedded, {
        x,
        y,
        xScale: scale,
        yScale: scale,
        rotate: degrees(-geometry.rotation),
      })
    }
    page.pushOperators(popGraphicsState())

    if (layout.assembly === 'direct' || options.showMarks === false) continue

    // Crop marks stay outside the art. Leave a gap so no marks enter the poster.
    const ink = rgb(0.35, 0.35, 0.35)
    for (const cx of [margin, layout.pageWidth - margin]) {
      for (const cy of [margin, layout.pageHeight - margin]) {
        const dx = cx === margin ? -1 : 1
        const dy = cy === margin ? -1 : 1
        page.drawLine({
          start: { x: cx + dx * MM, y: cy },
          end: { x: cx + dx * 3 * MM, y: cy },
          thickness: 0.4,
          color: ink,
        })
        page.drawLine({
          start: { x: cx, y: cy + dy * MM },
          end: { x: cx, y: cy + dy * 3 * MM },
          thickness: 0.4,
          color: ink,
        })
      }
    }
    page.drawText(
      `${index + 1} / ${count}   |   R${tile.row + 1} C${tile.column + 1}   |   ${paper} - 100%`,
      {
        x: margin + 4 * MM,
        y: margin - 3 * MM,
        size: 6,
        color: ink,
      },
    )
  }
  return { bytes: await output.save(), layout }
}
