import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BlobReader,
  BlobWriter,
  Uint8ArrayReader,
  ZipReader,
  ZipWriter,
} from '@zip.js/zip.js'
import { extractDocumentImages } from '../src/libs/document-extract/extract.ts'
import {
  downloadName,
  packImages,
} from '../src/libs/document-extract/download.ts'

test('ZIP download preserves bytes and resolves duplicate basenames', async () => {
  const selected = [
    'first/photo.png',
    'second/photo.png',
    'photo (2).png',
    '../PHOTO.PNG',
  ].map((name, index) => ({
    id: String(index),
    name,
    blob: new Blob([new Uint8Array([index, 137, 80, 78])]),
  }))
  const blob = await packImages(selected)
  assert.equal(blob.type, 'application/zip')
  const reader = new ZipReader(new BlobReader(blob))
  try {
    const entries = await reader.getEntries()
    assert.deepEqual(
      entries.map((entry) => entry.filename),
      ['photo.png', 'photo (2).png', 'photo (2) (2).png', 'PHOTO (3).PNG'],
    )
    for (const [index, entry] of entries.entries()) {
      assert.ok(!entry.directory)
      const result = await entry.getData(new BlobWriter())
      assert.deepEqual(
        new Uint8Array(await result.arrayBuffer()),
        new Uint8Array(await selected[index].blob.arrayBuffer()),
      )
    }
  } finally {
    await reader.close()
  }
})

test('download names remove paths and ZIP rejects empty or cancelled input', async () => {
  assert.equal(downloadName('../nested/photo.png'), 'photo.png')
  assert.equal(downloadName('folder\\photo.png'), 'photo.png')
  assert.equal(downloadName(''), 'image')
  await assert.rejects(packImages([]), /選擇/)
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(
    packImages(
      [{ id: '1', name: 'photo.png', blob: new Blob() }],
      controller.signal,
    ),
    { name: 'AbortError' },
  )
})

const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

async function documentFile(name: string, paths: string[]) {
  const writer = new ZipWriter(new BlobWriter(), { useWebWorkers: false })
  for (const path of paths) {
    await writer.add(path, new Uint8ArrayReader(bytes))
  }
  return new File([await writer.close()], name)
}

test('DOCX extracts only images in word/media and preserves bytes', async () => {
  const file = await documentFile('example.DOCX', [
    'word/media/image1.PNG',
    'word/media/sub/image1.png',
    'word/media/audio.mp3',
    'word/document.xml',
    'docProps/thumbnail.png',
    'Pictures/other.png',
  ])
  const images = await extractDocumentImages(file)
  assert.deepEqual(
    images.map((image) => image.id),
    ['word/media/image1.PNG', 'word/media/sub/image1.png'],
  )
  assert.equal(images[0].blob.type, 'image/png')
  assert.deepEqual(new Uint8Array(await images[0].blob.arrayBuffer()), bytes)
})

test('ODT reads Pictures including formats a browser may not preview', async () => {
  const file = await documentFile('example.odt', [
    'Pictures/photo.jpg',
    'Pictures/drawing.emf',
    'Thumbnails/thumbnail.png',
    'word/media/other.png',
    'Pictures/readme.txt',
  ])
  const images = await extractDocumentImages(file)
  assert.deepEqual(
    images.map((image) => image.name),
    ['photo.jpg', 'drawing.emf'],
  )
  assert.equal(images[0].blob.type, 'image/jpeg')
})

test('document without embedded images returns an empty result', async () => {
  assert.deepEqual(
    await extractDocumentImages(
      await documentFile('empty.docx', ['word/document.xml']),
    ),
    [],
  )
})

test('invalid ZIP and unsupported extension reject', async () => {
  await assert.rejects(
    extractDocumentImages(new File(['broken'], 'broken.docx')),
  )
  await assert.rejects(
    extractDocumentImages(new File(['broken'], 'legacy.doc')),
    /DOCX/,
  )
})

test('aborted extraction rejects without returning results', async () => {
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(
    extractDocumentImages(new File([], 'example.odt'), controller.signal),
    { name: 'AbortError' },
  )
})
