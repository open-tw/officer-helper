import { PDFDocument } from 'pdf-lib'

export type MergePage = { sourceId: string; pageIndex: number }
export type MergeSource = { id: string; name: string; document: PDFDocument }

export async function readMergeSource(data: ArrayBuffer) {
  try {
    const document = await PDFDocument.load(data)
    if (!document.getPageCount()) throw new Error('empty')
    return document
  } catch (error) {
    if (error instanceof Error && /encrypted/i.test(error.message)) {
      throw new Error('PDF 有加密保護，請先另存為未加密的 PDF。')
    }
    throw new Error('無法讀取 PDF，請確認檔案完整且格式正確。')
  }
}

export async function mergePdfPages(
  sources: MergeSource[],
  pages: MergePage[],
) {
  if (!pages.length) throw new Error('請至少選擇一頁。')
  const output = await PDFDocument.create()
  const documents = new Map(
    sources.map((source) => [source.id, source.document]),
  )
  // Copy contiguous runs together, keeping the requested cross-file order.
  for (let start = 0; start < pages.length;) {
    const sourceId = pages[start].sourceId
    const source = documents.get(sourceId)
    if (!source) throw new Error('找不到來源 PDF，請重新選擇檔案。')
    let end = start
    const indices: number[] = []
    while (end < pages.length && pages[end].sourceId === sourceId) {
      const index = pages[end].pageIndex
      if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= source.getPageCount()
      ) {
        throw new Error('選擇的頁碼無效。')
      }
      indices.push(index)
      end++
    }
    const copied = await output.copyPages(source, indices)
    copied.forEach((page) => output.addPage(page))
    start = end
  }
  return output.save()
}
