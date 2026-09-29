/** Format-neutral document data; future DOCX export consumes the same model. */
export type PhotoSheetPhoto = {
  id: string
  name: string
  image: Blob
  caption: string
  rotation: 0 | 90 | 180 | 270
  fit: 'contain' | 'cover'
}

export type PhotoSheet = {
  title: string
  subject: string
  date: string
  photosPerPage: 2 | 4 | 6
  photos: PhotoSheetPhoto[]
}

export const A4 = { width: 595.28, height: 841.89 }
export const LIMITS = { title: 40, subject: 80, caption: 80 }

export function paginatePhotos(sheet: PhotoSheet) {
  if (![2, 4, 6].includes(sheet.photosPerPage)) {
    throw new Error('請選擇每頁 2、4 或 6 張照片。')
  }
  const pages: PhotoSheetPhoto[][] = []
  for (let i = 0; i < sheet.photos.length; i += sheet.photosPerPage) {
    pages.push(sheet.photos.slice(i, i + sheet.photosPerPage))
  }
  return pages
}

export function validateSheet(sheet: PhotoSheet) {
  if (![2, 4, 6].includes(sheet.photosPerPage))
    throw new Error('請選擇每頁 2、4 或 6 張照片。')
  if (!sheet.photos.length) throw new Error('請至少加入一張照片。')
  if (
    sheet.title.length > LIMITS.title ||
    sheet.subject.length > LIMITS.subject
  )
    throw new Error('表單標題或案件名稱過長。')
  if (sheet.photos.some((photo) => photo.caption.length > LIMITS.caption))
    throw new Error('照片說明最多 80 字。')
}

export function movePhoto(
  photos: PhotoSheetPhoto[],
  id: string,
  target: number,
) {
  const index = photos.findIndex((photo) => photo.id === id)
  if (index < 0 || target < 0 || target >= photos.length) return photos
  const result = [...photos]
  const [photo] = result.splice(index, 1)
  result.splice(target, 0, photo)
  return result
}

/** Wrap by measured glyph width, including CJK and unbroken Latin text. */
export function wrapText(
  text: string,
  width: number,
  measure: (text: string) => number,
) {
  const lines: string[] = []
  let line = ''
  for (const character of text.replace(/\s+/g, ' ').trim()) {
    if (line && measure(line + character) > width) {
      lines.push(line)
      line = character
    } else line += character
  }
  if (line) lines.push(line)
  return lines
}

export function imagePlacement(
  width: number,
  height: number,
  boxWidth: number,
  boxHeight: number,
  rotation: PhotoSheetPhoto['rotation'],
  fit: PhotoSheetPhoto['fit'],
) {
  const swapped = rotation === 90 || rotation === 270
  const rotatedWidth = swapped ? height : width
  const rotatedHeight = swapped ? width : height
  const scale = (fit === 'cover' ? Math.max : Math.min)(
    boxWidth / rotatedWidth,
    boxHeight / rotatedHeight,
  )
  return { width: width * scale, height: height * scale }
}
