import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PDFDocument, PDFName, PageSizes, degrees, rgb } from 'pdf-lib'
import {
  createPoster,
  getPageGeometry,
  readPosterSource,
} from '../src/libs/pdf-poster.ts'
import {
  MM,
  OVERLAP,
  getPosterLayout,
  getTileOrigin,
} from '../src/libs/poster-layout.ts'

const papers = ['A4', 'A3'] as const
const counts = [2, 4, 8] as const

test('direct assembly is the default and has neither missing nor repeated strips', () => {
  for (const paper of papers)
    for (const count of counts) {
      const layout = getPosterLayout(210 * MM, 297 * MM, paper, count)
      assert.equal(layout.assembly, 'direct')
      assert.equal(layout.overlap, 0)
      assert.equal(layout.posterWidth, layout.columns * layout.tileWidth)
      assert.equal(layout.posterHeight, layout.rows * layout.tileHeight)
      if (layout.columns > 1)
        assert.equal(getTileOrigin(layout, 1).x, layout.tileWidth)
      if (layout.rows > 1)
        assert.ok(
          Math.abs(
            getTileOrigin(layout, 0).y -
              getTileOrigin(layout, layout.columns).y -
              layout.tileHeight,
          ) < 1e-8,
        )
    }
})

test('A4 portrait on two A3 sheets uses landscape sheets stacked vertically', () => {
  const layout = getPosterLayout(210 * MM, 297 * MM, 'A3', 2)
  assert.equal(layout.columns, 1)
  assert.equal(layout.rows, 2)
  assert.equal(layout.pageWidth, 420 * MM)
  assert.equal(layout.pageHeight, 297 * MM)
  assert.ok(layout.scale > 1.9 && layout.scale < 2)
})

test('all sizes and counts cover the entire source without distortion, with exact overlap', () => {
  for (const paper of papers)
    for (const count of counts) {
      for (const [width, height] of [
        [210, 297],
        [297, 210],
        [100, 100],
        [50, 500],
      ]) {
        const layout = getPosterLayout(
          width * MM,
          height * MM,
          paper,
          count,
          'trim',
        )
        assert.equal(layout.rows * layout.columns, count)
        assert.ok(layout.contentWidth <= layout.posterWidth + 1e-8)
        assert.ok(layout.contentHeight <= layout.posterHeight + 1e-8)
        assert.ok(
          Math.abs(
            layout.contentWidth / layout.contentHeight - width / height,
          ) < 1e-8,
        )
        const first = getTileOrigin(layout, 0)
        const last = getTileOrigin(layout, count - 1)
        assert.equal(first.x, 0)
        assert.ok(
          Math.abs(first.y + layout.tileHeight - layout.posterHeight) < 1e-8,
        )
        assert.ok(
          Math.abs(last.x + layout.tileWidth - layout.posterWidth) < 1e-8,
        )
        assert.ok(Math.abs(last.y) < 1e-8)
        if (layout.columns > 1) {
          assert.ok(
            Math.abs(
              first.x + layout.tileWidth - getTileOrigin(layout, 1).x - OVERLAP,
            ) < 1e-8,
          )
        }
        if (layout.rows > 1) {
          assert.ok(
            Math.abs(
              getTileOrigin(layout, layout.columns).y +
                layout.tileHeight -
                first.y -
                OVERLAP,
            ) < 1e-8,
          )
        }
        assert.ok(
          Math.abs(layout.pageWidth - layout.tileWidth - layout.margin * 2) <
            1e-8,
        )
      }
    }
})

test('invalid page dimensions are rejected', () => {
  for (const invalid of [0, -1, NaN, Infinity]) {
    assert.throws(() => getPosterLayout(invalid, 100, 'A4', 2), /尺寸/)
  }
})

test('CropBox intersection, nonzero origins and all quarter-turn rotations', async () => {
  const source = await PDFDocument.create()
  const page = source.addPage([600, 800])
  page.setMediaBox(-50, -30, 600, 800)
  page.setCropBox(-70, 10, 500, 900)
  for (const rotation of [0, 90, 180, 270]) {
    page.setRotation(degrees(rotation))
    const geometry = getPageGeometry(page)
    assert.deepEqual(
      [geometry.left, geometry.bottom, geometry.right, geometry.top],
      [-50, 10, 430, 770],
    )
    assert.equal(geometry.displayWidth, rotation % 180 ? 760 : 480)
    assert.equal(geometry.displayHeight, rotation % 180 ? 480 : 760)
  }
})

test('output always has the selected number and physical size of pages', async () => {
  const source = await PDFDocument.create()
  for (const rotation of [0, 90, 180, 270]) {
    const page = source.addPage(PageSizes.A4)
    page.setRotation(degrees(rotation))
    page.drawRectangle({
      x: 0,
      y: 0,
      width: 210,
      height: 297,
      color: rgb(1, 0, 0),
    })
  }
  for (let selected = 0; selected < 4; selected++) {
    for (const paper of papers)
      for (const count of counts) {
        const { bytes, layout } = await createPoster(
          source,
          selected,
          paper,
          count,
        )
        const output = await PDFDocument.load(bytes)
        assert.equal(output.getPageCount(), count)
        for (const page of output.getPages()) {
          assert.equal(page.getWidth(), layout.pageWidth)
          assert.equal(page.getHeight(), layout.pageHeight)
          assert.equal(page.getRotation().angle, 0)
        }
      }
  }
})

test('blank PDFs can be tiled and malformed PDFs produce a helpful error', async () => {
  const source = await PDFDocument.create()
  source.addPage(PageSizes.A4)
  const { bytes } = await createPoster(source, 0, 'A4', 2)
  assert.equal((await PDFDocument.load(bytes)).getPageCount(), 2)
  await assert.rejects(
    readPosterSource(new TextEncoder().encode('not a PDF').buffer),
    /無法讀取/,
  )
})

test('forms and visible annotations are not silently dropped', async () => {
  const source = await PDFDocument.create()
  const page = source.addPage(PageSizes.A4)
  const field = source.getForm().createTextField('name')
  field.setText('Example')
  field.addToPage(page, { x: 40, y: 40, width: 200, height: 30 })
  await assert.rejects(createPoster(source, 0, 'A4', 2), /表單或註記/)
  page.node.delete(PDFName.of('Annots'))
  await assert.doesNotReject(createPoster(source, 0, 'A4', 2))
})
