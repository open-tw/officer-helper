import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { PDFDocument } from 'pdf-lib'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import {
  A4,
  imagePlacement,
  movePhoto,
  paginatePhotos,
  validateSheet,
  wrapText,
} from '../src/libs/photo-sheet/model.ts'
import type { PhotoSheet } from '../src/libs/photo-sheet/model.ts'
import { renderPhotoSheetPage } from '../src/libs/photo-sheet/render.ts'
import type { DrawingRuntime } from '../src/libs/photo-sheet/render.ts'
import { exportPhotoSheetOdt } from '../src/libs/photo-sheet/odt.ts'
import { BlobReader, TextWriter, ZipReader } from '@zip.js/zip.js'
import { exportPhotoSheetPdf } from '../src/libs/photo-sheet/export.ts'

const runtime: DrawingRuntime = {
  canvas: () => createCanvas(1, 1) as unknown as HTMLCanvasElement,
  decode: async (blob) => {
    const image = await loadImage(Buffer.from(await blob.arrayBuffer()))
    return {
      image: image as unknown as CanvasImageSource,
      width: image.width,
      height: image.height,
      close: () => {},
    }
  },
}

function fixture(count = 7): PhotoSheet {
  const canvas = createCanvas(600, 360)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#c92535'
  ctx.fillRect(0, 0, 300, 360)
  ctx.fillStyle = '#166ac4'
  ctx.fillRect(300, 0, 300, 360)
  ctx.fillStyle = '#ffffff'
  ctx.font = '40px sans-serif'
  ctx.fillText('LEFT', 60, 100)
  ctx.fillText('RIGHT', 360, 270)
  const image = new Blob([new Uint8Array(canvas.toBuffer('image/png'))], {
    type: 'image/png',
  })
  return {
    title: '社區活動照片佐證表',
    subject: '社區環境改善計畫－居民說明會與現場紀錄',
    date: '2026-09-29',
    photosPerPage: 4,
    photos: Array.from({ length: count }, (_, index) => ({
      id: `photo-${index}`,
      name: `photo-${index}.png`,
      image,
      caption:
        index === 0
          ? '舉辦說明會，向居民介紹工程內容、施工時程與注意事項，並蒐集意見作為後續執行參考。'
              .repeat(2)
              .slice(0, 80)
          : `現場紀錄 ${index + 1}：辦理活動與成果說明。`,
      rotation: ([0, 90, 180, 270] as const)[index % 4],
      fit: index % 2 ? 'cover' : 'contain',
    })),
  }
}

test('pagination keeps caption, image, and order together for all templates', () => {
  for (const count of [2, 4, 6] as const) {
    const sheet = { ...fixture(), photosPerPage: count }
    const pages = paginatePhotos(sheet)
    assert.equal(pages.length, Math.ceil(7 / count))
    assert.deepEqual(pages.flat(), sheet.photos)
    assert.equal(pages.at(-1)?.length, count === 2 ? 1 : count === 4 ? 3 : 1)
  }
})

test('reordering preserves photo descriptions and does not mutate the input', () => {
  const sheet = fixture(4)
  const moved = movePhoto(sheet.photos, 'photo-0', 3)
  assert.deepEqual(
    moved.map((photo) => photo.id),
    ['photo-1', 'photo-2', 'photo-3', 'photo-0'],
  )
  assert.equal(moved[3].caption, sheet.photos[0].caption)
  assert.equal(sheet.photos[0].id, 'photo-0')
  assert.equal(movePhoto(sheet.photos, 'missing', 1), sheet.photos)
  assert.equal(movePhoto(sheet.photos, 'photo-0', -1), sheet.photos)
})

test('image fitting preserves aspect ratio and accounts for rotation', () => {
  assert.deepEqual(imagePlacement(600, 300, 200, 200, 0, 'contain'), {
    width: 200,
    height: 100,
  })
  assert.deepEqual(imagePlacement(600, 300, 100, 200, 90, 'contain'), {
    width: 200,
    height: 100,
  })
  assert.deepEqual(imagePlacement(600, 300, 100, 200, 0, 'cover'), {
    width: 400,
    height: 200,
  })
})

test('CJK, unbroken text, whitespace and empty captions wrap without losing content', () => {
  const measure = (text: string) => Array.from(text).length * 10
  assert.deepEqual(wrapText('舉辦說明會與現場紀錄', 40, measure), [
    '舉辦說明',
    '會與現場',
    '紀錄',
  ])
  assert.deepEqual(wrapText('ABCDEFG', 30, measure), ['ABC', 'DEF', 'G'])
  assert.deepEqual(wrapText('   \n  ', 30, measure), [])
  assert.equal(wrapText('照片\n 說明', 100, measure).join(''), '照片 說明')
})

test('empty sheets and overlong captions are rejected before export', async () => {
  await assert.rejects(exportPhotoSheetPdf(fixture(0), {}, runtime), /至少/)
  const sheet = fixture(1)
  sheet.photos[0].caption = '說'.repeat(81)
  assert.throws(() => validateSheet(sheet), /80/)
})

test('preview supports every template, long headers, blank captions and odd final pages', async () => {
  const sheet = fixture()
  sheet.title = '社區活動成果照片佐證表'.repeat(4).slice(0, 40)
  sheet.subject = '居民說明會與現場施工紀錄'.repeat(8).slice(0, 80)
  sheet.photos[6].caption = ''
  for (const photosPerPage of [2, 4, 6] as const) {
    sheet.photosPerPage = photosPerPage
    const pages = paginatePhotos(sheet)
    for (let index = 0; index < pages.length; index++) {
      const canvas = await renderPhotoSheetPage(sheet, index, {
        runtime,
        scale: 1,
      })
      assert.equal(canvas.width, Math.ceil(A4.width))
      assert.equal(canvas.height, Math.ceil(A4.height))
      if (process.env.PHOTO_SHEET_QA_DIR) {
        await mkdir(process.env.PHOTO_SHEET_QA_DIR, { recursive: true })
        const blob = await new Promise<Blob>((resolve) =>
          canvas.toBlob((value) => resolve(value!), 'image/png'),
        )
        await writeFile(
          join(
            process.env.PHOTO_SHEET_QA_DIR,
            `preview-${photosPerPage}-${index + 1}.png`,
          ),
          new Uint8Array(await blob.arrayBuffer()),
        )
      }
      canvas.width = canvas.height = 0
    }
  }
})

test('PDF exports A4 pages, reports progress, and matches preview when independently rendered', async () => {
  const sheet = fixture(5)
  const progress: number[] = []
  const blob = await exportPhotoSheetPdf(
    sheet,
    {
      onProgress: (completed, total) => {
        assert.equal(total, 2)
        progress.push(completed)
      },
    },
    runtime,
  )
  assert.equal(blob.type, 'application/pdf')
  assert.deepEqual(progress, [1, 2])
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const pdf = await PDFDocument.load(bytes)
  assert.equal(pdf.getPageCount(), 2)
  assert.deepEqual(pdf.getPage(0).getSize(), A4)
  assert.equal(pdf.getTitle(), sheet.title)
  const task = getDocument({ data: bytes.slice() })
  try {
    const document = await task.promise
    const page = await document.getPage(1)
    const viewport = page.getViewport({ scale: 1 })
    const canvas = createCanvas(
      Math.ceil(viewport.width),
      Math.ceil(viewport.height),
    )
    await page.render({
      canvas: null,
      canvasContext: canvas.getContext(
        '2d',
      ) as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise
    const preview = await renderPhotoSheetPage(sheet, 0, { scale: 1, runtime })
    const expected = preview
      .getContext('2d')!
      .getImageData(0, 0, preview.width, preview.height).data
    const actual = canvas
      .getContext('2d')
      .getImageData(0, 0, canvas.width, canvas.height).data
    let difference = 0
    for (let index = 0; index < actual.length; index += 4) {
      difference +=
        Math.abs(actual[index] - expected[index]) +
        Math.abs(actual[index + 1] - expected[index + 1]) +
        Math.abs(actual[index + 2] - expected[index + 2])
    }
    assert.ok(
      difference / ((actual.length / 4) * 3) < 6,
      'PDF rendering should agree with preview despite JPEG antialiasing',
    )
    if (process.env.PHOTO_SHEET_QA_DIR) {
      await mkdir(process.env.PHOTO_SHEET_QA_DIR, { recursive: true })
      await writeFile(
        join(process.env.PHOTO_SHEET_QA_DIR, 'photo-sheet.pdf'),
        bytes,
      )
      await writeFile(
        join(process.env.PHOTO_SHEET_QA_DIR, 'pdf-rendered.png'),
        canvas.toBuffer('image/png'),
      )
    }
  } finally {
    await task.destroy()
  }
})

test('aborted export stops before rendering or reporting progress', async () => {
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(
    exportPhotoSheetPdf(
      fixture(),
      {
        signal: controller.signal,
        onProgress: () =>
          assert.fail('cancelled export must not report progress'),
      },
      runtime,
    ),
    { name: 'AbortError' },
  )
})

test('rendered rotation puts the left half above the right half after a clockwise turn', async () => {
  const sheet = fixture(1)
  sheet.title = '照片佐證表'
  sheet.subject = ''
  sheet.date = ''
  sheet.photosPerPage = 2
  sheet.photos[0].rotation = 90
  sheet.photos[0].fit = 'contain'
  sheet.photos[0].caption = ''
  const canvas = await renderPhotoSheetPage(sheet, 0, { runtime, scale: 1 })
  const ctx = canvas.getContext('2d')!
  // First cell center and points well inside the rotated image, away from labels.
  const top = ctx.getImageData(165, 315, 1, 1).data
  const bottom = ctx.getImageData(165, 510, 1, 1).data
  assert.ok(
    top[0] > 150 && top[2] < 100,
    'red left half should rotate to the top',
  )
  assert.ok(
    bottom[2] > 150 && bottom[0] < 100,
    'blue right half should rotate to the bottom',
  )
})

test('ODT preserves editable text, two-column tables, images and explicit page breaks', async () => {
  for (const photosPerPage of [2, 4, 6] as const) {
    const sheet = fixture(7)
    sheet.photosPerPage = photosPerPage
    sheet.title = '照片佐證表 & <活動>'
    sheet.photos[0].caption = '舉辦說明會 & <照片證明>'
    sheet.photos[6].caption = ''
    const progress: number[] = []
    const blob = await exportPhotoSheetOdt(
      sheet,
      { onProgress: (completed) => progress.push(completed) },
      runtime,
    )
    assert.equal(blob.type, 'application/vnd.oasis.opendocument.text')
    assert.deepEqual(
      progress,
      Array.from({ length: Math.ceil(7 / photosPerPage) }, (_, i) => i + 1),
    )
    const reader = new ZipReader(new BlobReader(blob))
    try {
      const entries = await reader.getEntries()
      assert.equal(entries[0].filename, 'mimetype')
      assert.equal(entries[0].compressionMethod, 0)
      const contentEntry = entries.find(
        (entry) => entry.filename === 'content.xml',
      )
      const stylesEntry = entries.find(
        (entry) => entry.filename === 'styles.xml',
      )
      assert.ok(contentEntry && !contentEntry.directory)
      assert.ok(stylesEntry && !stylesEntry.directory)
      const content = await contentEntry.getData(new TextWriter())
      const styles = await stylesEntry.getData(new TextWriter())
      assert.match(content, /舉辦說明會 &amp; &lt;照片證明&gt;/)
      assert.match(content, /fo:keep-together="always"/)
      assert.equal((content.match(/<table:table-row /g) ?? []).length, 4)
      assert.equal((content.match(/<draw:image /g) ?? []).length, 7)
      assert.equal(
        entries.filter(
          (entry) => entry.filename.startsWith('Pictures/') && !entry.directory,
        ).length,
        7,
      )
      assert.match(styles, /fo:page-width="21cm"/)
      assert.match(styles, /fo:page-height="29.7cm"/)
      assert.match(styles, /text:page-number/)
      assert.ok(content.indexOf('照片 1') < content.indexOf('照片 7'))
      if (process.env.PHOTO_SHEET_QA_DIR) {
        await mkdir(process.env.PHOTO_SHEET_QA_DIR, { recursive: true })
        await writeFile(
          join(
            process.env.PHOTO_SHEET_QA_DIR,
            `photo-sheet-${photosPerPage}.odt`,
          ),
          new Uint8Array(await blob.arrayBuffer()),
        )
      }
    } finally {
      await reader.close()
    }
  }
})

test('ODT rejects an empty sheet and respects cancellation', async () => {
  await assert.rejects(exportPhotoSheetOdt(fixture(0), {}, runtime), /至少/)
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(
    exportPhotoSheetOdt(fixture(), { signal: controller.signal }, runtime),
    { name: 'AbortError' },
  )
})

test('DOCX exports editable two-column tables, linked images, A4 geometry and page breaks', async () => {
  const { exportPhotoSheetDocx } =
    await import('../src/libs/photo-sheet/docx.ts')
  for (const photosPerPage of [2, 4, 6] as const) {
    const sheet = fixture(7)
    sheet.photosPerPage = photosPerPage
    sheet.title = '照片佐證表 & <活動>'
    sheet.photos[0].caption = '舉辦說明會 & <照片證明>'
    sheet.photos[6].caption = ''
    // Exercise a reordered document rather than just the original file order.
    sheet.photos = movePhoto(sheet.photos, 'photo-0', 3)
    const progress: number[] = []
    const blob = await exportPhotoSheetDocx(
      sheet,
      { onProgress: (completed) => progress.push(completed) },
      runtime,
    )
    const pageCount = Math.ceil(7 / photosPerPage)
    assert.equal(
      blob.type,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    )
    assert.deepEqual(
      progress,
      Array.from({ length: pageCount }, (_, i) => i + 1),
    )
    const reader = new ZipReader(new BlobReader(blob))
    try {
      const entries = await reader.getEntries()
      const xml = async (name: string) => {
        const entry = entries.find((item) => item.filename === name)
        assert.ok(entry && !entry.directory)
        return entry.getData(new TextWriter())
      }
      const content = await xml('word/document.xml')
      const relationships = await xml('word/_rels/document.xml.rels')
      const styles = await xml('word/styles.xml')
      const footer = await xml('word/footer1.xml')
      assert.match(content, /舉辦說明會 &amp; &lt;照片證明&gt;/)
      assert.equal((content.match(/<w:tbl>/g) ?? []).length, pageCount)
      assert.equal((content.match(/<w:tr>/g) ?? []).length, 4)
      assert.equal((content.match(/<w:cantSplit\/>/g) ?? []).length, 4)
      assert.equal((content.match(/<w:gridCol /g) ?? []).length, pageCount * 2)
      assert.equal(
        (content.match(/<w:tblLayout w:type="fixed"/g) ?? []).length,
        pageCount,
      )
      assert.equal((content.match(/<wp:inline /g) ?? []).length, 7)
      assert.equal(
        (content.match(/<w:pageBreakBefore\/>/g) ?? []).length,
        pageCount - 1,
      )
      assert.match(content, /w:pgSz w:w="11906" w:h="16838"/)
      assert.match(styles, /w:eastAsia="Noto Sans CJK TC"/)
      assert.match(footer, /PAGE/)
      assert.ok(content.indexOf('現場紀錄 2') < content.indexOf('舉辦說明會'))
      for (const match of content.matchAll(/r:embed="([^"]+)"/g)) {
        const relation = Array.from(
          relationships.matchAll(/<Relationship\b[^>]*>/g),
        ).find((item) => item[0].includes(`Id="${match[1]}"`))?.[0]
        assert.ok(relation, 'every image must have a relationship')
        const target = /Target="([^"]+)"/.exec(relation)?.[1]
        assert.ok(
          entries.some((entry) => entry.filename === `word/${target}`),
          'every image relationship must resolve to embedded media',
        )
      }
      assert.ok(
        !relationships.includes('TargetMode="External"'),
        'photos should not depend on external URLs',
      )
      if (process.env.PHOTO_SHEET_QA_DIR) {
        await mkdir(process.env.PHOTO_SHEET_QA_DIR, { recursive: true })
        await writeFile(
          join(
            process.env.PHOTO_SHEET_QA_DIR,
            `photo-sheet-${photosPerPage}.docx`,
          ),
          new Uint8Array(await blob.arrayBuffer()),
        )
      }
    } finally {
      await reader.close()
    }
  }
})

test('DOCX rejects empty input and cancellation before or during export', async () => {
  const { exportPhotoSheetDocx } =
    await import('../src/libs/photo-sheet/docx.ts')
  await assert.rejects(exportPhotoSheetDocx(fixture(0), {}, runtime), /至少/)
  const aborted = new AbortController()
  aborted.abort()
  await assert.rejects(
    exportPhotoSheetDocx(fixture(), { signal: aborted.signal }, runtime),
    { name: 'AbortError' },
  )
  const controller = new AbortController()
  await assert.rejects(
    exportPhotoSheetDocx(
      fixture(),
      { signal: controller.signal, onProgress: () => controller.abort() },
      runtime,
    ),
    { name: 'AbortError' },
  )
})
