import assert from 'node:assert/strict'
import test from 'node:test'
import { PDFDocument, degrees } from 'pdf-lib'
import { mergePdfPages, readMergeSource } from '../src/libs/pdf-merge.ts'

async function fixture() {
  const a = await PDFDocument.create()
  a.addPage([100, 200])
  a.addPage([300, 400]).setRotation(degrees(90))
  const b = await PDFDocument.create()
  b.addPage([500, 600])
  return [
    { id: 'a', name: 'a.pdf', document: a },
    { id: 'b', name: 'b.pdf', document: b },
  ]
}

test('merges complete documents in file order', async () => {
  const sources = await fixture()
  const bytes = await mergePdfPages(sources, [
    { sourceId: 'b', pageIndex: 0 },
    { sourceId: 'a', pageIndex: 0 },
    { sourceId: 'a', pageIndex: 1 },
  ])
  const output = await PDFDocument.load(bytes)
  assert.deepEqual(
    output.getPages().map((page) => page.getWidth()),
    [500, 100, 300],
  )
  assert.equal(output.getPage(2).getRotation().angle, 90)
})

test('supports selection and interleaving without changing source pages', async () => {
  const sources = await fixture()
  const bytes = await mergePdfPages(sources, [
    { sourceId: 'a', pageIndex: 1 },
    { sourceId: 'b', pageIndex: 0 },
    { sourceId: 'a', pageIndex: 0 },
  ])
  const output = await PDFDocument.load(bytes)
  assert.deepEqual(
    output.getPages().map((page) => page.getWidth()),
    [300, 500, 100],
  )
  assert.equal(sources[0].document.getPageCount(), 2)
  const selected = await PDFDocument.load(
    await mergePdfPages(sources, [{ sourceId: 'a', pageIndex: 1 }]),
  )
  assert.equal(selected.getPageCount(), 1)
  assert.equal(selected.getPage(0).getWidth(), 300)
})

test('rejects empty selections, missing sources, and invalid page indices', async () => {
  const sources = await fixture()
  await assert.rejects(mergePdfPages(sources, []), /至少/)
  await assert.rejects(
    mergePdfPages(sources, [{ sourceId: 'missing', pageIndex: 0 }]),
    /來源/,
  )
  for (const pageIndex of [-1, 2, 0.5]) {
    await assert.rejects(
      mergePdfPages(sources, [{ sourceId: 'a', pageIndex }]),
      /頁碼/,
    )
  }
})

test('reads valid PDFs and reports malformed inputs', async () => {
  const [source] = await fixture()
  const bytes = await source.document.save()
  const parsed = await readMergeSource(new Uint8Array(bytes).buffer)
  assert.equal(parsed.getPageCount(), 2)
  await assert.rejects(readMergeSource(new ArrayBuffer(0)), /無法讀取/)
})
