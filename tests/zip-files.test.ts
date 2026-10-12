import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BlobReader, BlobWriter, ZipReader, ZipWriter } from '@zip.js/zip.js'
import {
  availableName,
  mergeZipFiles,
  sameContent,
} from '../src/libs/zip-files.ts'

const file = (name: string, content: string, lastModified = 1) =>
  new File([content], name, { lastModified })

test('content comparison detects differences despite identical metadata and across chunk boundaries', async () => {
  assert.equal(await sameContent(file('a', 'abc'), file('a', 'abd')), false)
  assert.equal(await sameContent(file('a', 'abc'), file('a', 'abcd')), false)
  assert.equal(await sameContent(new Blob(), new Blob()), true)
  const bytes = new Uint8Array(1024 * 1024 + 1)
  const original = new Blob([bytes])
  assert.equal(await sameContent(original, new Blob([bytes])), true)
  bytes[bytes.length - 1] = 1
  assert.equal(await sameContent(original, new Blob([bytes])), false)
})

test('identical contents are skipped regardless of modification time', async () => {
  const original = file('a.txt', 'abc')
  const result = await mergeZipFiles(
    [original],
    [file('a.txt', 'abc', 2)],
    async () => {
      assert.fail('identical file should not prompt')
    },
  )
  assert.deepEqual(result.files, [original])
  assert.equal(result.duplicates, 1)
})

test('replace and cancel preserve expected contents and continue the batch', async () => {
  const original = file('a.txt', 'abc')
  const replacement = file('a.txt', 'def')
  const extra = file('b.txt', 'ghi')
  const replaced = await mergeZipFiles(
    [original],
    [replacement],
    async () => 'replace',
  )
  assert.deepEqual(replaced.files, [replacement])
  const cancelled = await mergeZipFiles(
    [original],
    [replacement, extra],
    async () => 'cancel',
  )
  assert.deepEqual(cancelled.files, [original, extra])
})

test('same-batch conflicts use successive available names and produce a readable ZIP', async () => {
  const incoming = [
    file('a.txt', 'one'),
    file('a(1).txt', 'reserved'),
    file('a.txt', 'two'),
    file('a.txt', 'three'),
  ]
  const result = await mergeZipFiles([], incoming, async () => 'keep')
  assert.deepEqual(
    result.files.map((f) => f.name),
    ['a.txt', 'a(1).txt', 'a(2).txt', 'a(3).txt'],
  )
  assert.equal(incoming[2].name, 'a.txt')
  assert.equal(result.files[2].lastModified, incoming[2].lastModified)
  const writer = new ZipWriter(new BlobWriter(), { useWebWorkers: false })
  for (const f of result.files) await writer.add(f.name, new BlobReader(f))
  const reader = new ZipReader(new BlobReader(await writer.close()), {
    useWebWorkers: false,
  })
  try {
    const entries = await reader.getEntries()
    assert.deepEqual(
      entries.map((e) => e.filename),
      result.files.map((f) => f.name),
    )
    const contents = []
    for (const entry of entries) {
      assert.ok(!entry.directory)
      contents.push(await (await entry.getData(new BlobWriter())).text())
    }
    assert.deepEqual(contents, ['one', 'reserved', 'two', 'three'])
  } finally {
    await reader.close()
  }
})

test('coexistence handles extensionless files and dotfiles', () => {
  assert.equal(
    availableName('README', new Set(['README', 'README(1)'])),
    'README(2)',
  )
  assert.equal(availableName('.env', new Set(['.env'])), '.env(1)')
  assert.equal(
    availableName('report.pdf', new Set(['report.pdf'])),
    'report(1).pdf',
  )
})
