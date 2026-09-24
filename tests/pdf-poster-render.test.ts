import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { createCanvas } from '@napi-rs/canvas'
import { PDFDocument, PDFName, PDFNumber, degrees, rgb } from 'pdf-lib'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { PDFPageProxy } from 'pdfjs-dist'
import { createPoster } from '../src/libs/pdf-poster.ts'
import { getTileOrigin } from '../src/libs/poster-layout.ts'

const assets = dirname(
  createRequire(import.meta.url).resolve('pdfjs-dist/package.json'),
)

async function render(page: PDFPageProxy, scale: number) {
  const viewport = page.getViewport({ scale })
  const canvas = createCanvas(
    Math.ceil(viewport.width),
    Math.ceil(viewport.height),
  )
  const context = canvas.getContext('2d')
  await page.render({
    canvas: null,
    canvasContext: context as unknown as CanvasRenderingContext2D,
    viewport,
    intent: 'print',
  }).promise
  return { canvas, context }
}

function open(bytes: Uint8Array) {
  return getDocument({
    data: bytes.slice(),
    standardFontDataUrl: join(assets, 'standard_fonts/'),
    cMapUrl: join(assets, 'cmaps/'),
    cMapPacked: true,
  })
}

test('rendered tiles preserve crop, rotation, page selection and seam content', async () => {
  const source = await PDFDocument.create()
  // Offset boxes catch assumptions that a page always starts at (0, 0).
  for (const rotation of [0, 90, 180, 270]) {
    const page = source.addPage([600, 850])
    page.setMediaBox(-50, -70, 600, 850)
    page.setCropBox(-20, -30, 500, 760)
    page.setRotation(degrees(rotation))
    if (rotation === 270) page.node.set(PDFName.of('UserUnit'), PDFNumber.of(2))
    for (let row = 0; row < 8; row++)
      for (let col = 0; col < 6; col++) {
        page.drawRectangle({
          x: -50 + col * 100,
          y: -70 + row * 106.25,
          width: 100,
          height: 106.25,
          color: rgb((col + 1) / 7, (row + 1) / 9, (((row + col) % 4) + 1) / 5),
        })
      }
    page.drawText(`ROTATION ${rotation}`, { x: 10, y: 640, size: 28 })
    page.drawText('TOP', { x: 130, y: 580, size: 60 })
    page.drawText('BOTTOM', { x: 50, y: 20, size: 40 })
  }
  const sourceBytes = await source.save()
  const sourceTask = open(sourceBytes)
  const sourcePdf = await sourceTask.promise
  try {
    for (let selected = 0; selected < 4; selected++) {
      for (const assembly of ['direct', 'trim'] as const) {
        for (const count of [2, 4, 8] as const) {
          const generated = await createPoster(
            source,
            selected,
            count === 4 ? 'A4' : 'A3',
            count,
            { assembly },
          )
          const { layout } = generated
          const task = open(generated.bytes)
          const pdf = await task.promise
          const refPage = await sourcePdf.getPage(selected + 1)
          const natural = refPage.getViewport({ scale: 1 })
          const rasterScale = 0.6
          const reference = await render(
            refPage,
            (layout.contentWidth / natural.width) * rasterScale,
          )
          try {
            for (let index = 0; index < count; index++) {
              const rendered = await render(
                await pdf.getPage(index + 1),
                rasterScale,
              )
              const tile = getTileOrigin(layout, index)
              const offsetX = (layout.posterWidth - layout.contentWidth) / 2
              const offsetY = (layout.posterHeight - layout.contentHeight) / 2
              let checked = 0
              let mismatch = 0
              // Compare independent PDF.js renderings of the source and output.
              // Samples near antialiased edges may differ by a pixel.
              for (let y = 12; y < layout.tileHeight - 12; y += 23) {
                for (let x = 12; x < layout.tileWidth - 12; x += 23) {
                  const sourceX = tile.x + x - offsetX
                  const sourceY = tile.y + y - offsetY
                  if (
                    sourceX < 2 ||
                    sourceX > layout.contentWidth - 2 ||
                    sourceY < 2 ||
                    sourceY > layout.contentHeight - 2
                  )
                    continue
                  const rx = Math.floor(sourceX * rasterScale)
                  const ry = Math.floor(
                    (layout.contentHeight - sourceY) * rasterScale,
                  )
                  const neighborhood = reference.context.getImageData(
                    rx - 1,
                    ry - 1,
                    3,
                    3,
                  ).data
                  // Exclude edges, where subpixel rounding legitimately changes antialiasing.
                  if (
                    [0, 1, 2].some((channel) => {
                      const values = Array.from(
                        { length: 9 },
                        (_, pixel) => neighborhood[pixel * 4 + channel],
                      )
                      return Math.max(...values) - Math.min(...values) > 20
                    })
                  )
                    continue
                  const expected = reference.context.getImageData(
                    rx,
                    ry,
                    1,
                    1,
                  ).data
                  const actual = rendered.context.getImageData(
                    Math.floor((layout.margin + x) * rasterScale),
                    Math.floor(
                      (layout.pageHeight - layout.margin - y) * rasterScale,
                    ),
                    1,
                    1,
                  ).data
                  if (
                    [0, 1, 2].some(
                      (channel) =>
                        Math.abs(expected[channel] - actual[channel]) > 25,
                    )
                  )
                    mismatch++
                  checked++
                }
              }
              assert.ok(checked > 30)
              assert.ok(
                mismatch / checked < 0.005,
                `page=${selected} ${assembly} count=${count} tile=${index}: ${mismatch}/${checked} pixels differ`,
              )
              if (assembly === 'direct') {
                const texts = await (
                  await pdf.getPage(index + 1)
                ).getTextContent()
                assert.ok(
                  !texts.items.some(
                    (item) => 'str' in item && item.str.includes('100%'),
                  ),
                )
              }
              // Optional local visual QA artifacts; excluded from ordinary tests.
              if (process.env.POSTER_QA_DIR && selected === 1 && count === 2) {
                await mkdir(process.env.POSTER_QA_DIR, { recursive: true })
                await writeFile(
                  join(
                    process.env.POSTER_QA_DIR,
                    `${assembly}-${index + 1}.png`,
                  ),
                  rendered.canvas.toBuffer('image/png'),
                )
                await writeFile(
                  join(process.env.POSTER_QA_DIR, `${assembly}.pdf`),
                  generated.bytes,
                )
                await writeFile(
                  join(process.env.POSTER_QA_DIR, 'source.png'),
                  reference.canvas.toBuffer('image/png'),
                )
              }
            }
          } finally {
            await task.destroy()
          }
        }
      }
    }
  } finally {
    await sourceTask.destroy()
  }
})

test('hiding trim marks leaves the artwork and page layout unchanged', async () => {
  const source = await PDFDocument.create()
  const page = source.addPage([595, 842])
  page.drawRectangle({
    x: 0,
    y: 0,
    width: 595,
    height: 842,
    color: rgb(0.2, 0.4, 0.8),
  })
  const withMarks = await createPoster(source, 0, 'A4', 2, {
    assembly: 'trim',
    showMarks: true,
  })
  const withoutMarks = await createPoster(source, 0, 'A4', 2, {
    assembly: 'trim',
    showMarks: false,
  })
  assert.deepEqual(withMarks.layout, withoutMarks.layout)
  const tasks = [open(withMarks.bytes), open(withoutMarks.bytes)]
  try {
    const pdfs = await Promise.all(tasks.map((task) => task.promise))
    const images = await Promise.all(
      pdfs.map(async (pdf) => render(await pdf.getPage(1), 1)),
    )
    const layout = withMarks.layout
    const x = Math.ceil(layout.margin + 1)
    const y = Math.ceil(layout.margin + 1)
    const w = Math.floor(layout.tileWidth - 2)
    const h = Math.floor(layout.tileHeight - 2)
    assert.deepEqual(
      images[0].context.getImageData(x, y, w, h).data,
      images[1].context.getImageData(x, y, w, h).data,
    )
    const texts = await (await pdfs[1].getPage(1)).getTextContent()
    assert.equal(texts.items.length, 0)
  } finally {
    await Promise.all(tasks.map((task) => task.destroy()))
  }
})
