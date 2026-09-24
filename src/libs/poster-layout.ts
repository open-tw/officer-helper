/** All dimensions are PDF points (72 points = 1 inch). */
export const MM = 72 / 25.4
export const MARGIN = 5 * MM
export const OVERLAP = 5 * MM

export type PosterPaper = 'A4' | 'A3'
export type PosterCount = 2 | 4 | 8
export type PosterAssembly = 'direct' | 'trim'

export type PosterLayout = {
  paper: PosterPaper
  count: PosterCount
  columns: number
  rows: number
  pageWidth: number
  pageHeight: number
  tileWidth: number
  tileHeight: number
  posterWidth: number
  posterHeight: number
  contentWidth: number
  contentHeight: number
  scale: number
  assembly: PosterAssembly
  overlap: number
  margin: number
}

export function getPosterLayout(
  width: number,
  height: number,
  paper: PosterPaper,
  count: PosterCount,
  assembly: PosterAssembly = 'direct',
): PosterLayout {
  if (![width, height].every((n) => Number.isFinite(n) && n > 0)) {
    throw new Error('無法辨識這一頁的尺寸，請換一份 PDF。')
  }
  const [short, long] =
    paper === 'A4' ? [210 * MM, 297 * MM] : [297 * MM, 420 * MM]
  // Balanced grids keep posters easy to assemble; avoid long strips.
  const grids =
    count === 2
      ? [
          [1, 2],
          [2, 1],
        ]
      : count === 4
        ? [[2, 2]]
        : [
            [2, 4],
            [4, 2],
          ]
  let best: PosterLayout | undefined
  // Direct assembly uses each region once, with no repeated art at the seams.
  const overlap = assembly === 'trim' ? OVERLAP : 0
  // Crop marks need printable space outside the art, beyond the 5 mm safe edge.
  const margin = assembly === 'trim' ? MARGIN + 3 * MM : MARGIN
  for (const [columns, rows] of grids) {
    for (const [pageWidth, pageHeight] of [
      [short, long],
      [long, short],
    ]) {
      const tileWidth = pageWidth - margin * 2
      const tileHeight = pageHeight - margin * 2
      const posterWidth = columns * tileWidth - (columns - 1) * overlap
      const posterHeight = rows * tileHeight - (rows - 1) * overlap
      const scale = Math.min(posterWidth / width, posterHeight / height)
      if (!best || scale > best.scale) {
        best = {
          paper,
          count,
          columns,
          rows,
          pageWidth,
          pageHeight,
          tileWidth,
          tileHeight,
          posterWidth,
          posterHeight,
          contentWidth: width * scale,
          contentHeight: height * scale,
          scale,
          assembly,
          overlap,
          margin,
        }
      }
    }
  }
  return best!
}

/** Row-major order, starting at the top left; PDF coordinates start at bottom left. */
export function getTileOrigin(layout: PosterLayout, index: number) {
  const column = index % layout.columns
  const row = Math.floor(index / layout.columns)
  return {
    column,
    row,
    x: column * (layout.tileWidth - layout.overlap),
    y:
      layout.posterHeight -
      layout.tileHeight -
      row * (layout.tileHeight - layout.overlap),
  }
}
