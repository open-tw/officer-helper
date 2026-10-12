import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BlobReader, BlobWriter, ZipReader, ZipWriter } from '@zip.js/zip.js'
import {
  encryptionError,
  encryptionOptions,
} from '../src/libs/zip-encryption.ts'

const settings = {
  method: 'zipcrypto' as const,
  enabled: true,
  showPassword: false,
  password: ' 密碼-test ',
  confirmation: ' 密碼-test ',
}

test('hidden passwords require matching confirmation; visible passwords only require one entry', () => {
  assert.equal(encryptionError(settings), null)
  assert.ok(encryptionError({ ...settings, password: '' }))
  assert.ok(encryptionError({ ...settings, confirmation: '' }))
  assert.ok(encryptionError({ ...settings, confirmation: 'different' }))
  assert.equal(
    encryptionError({ ...settings, showPassword: true, confirmation: '' }),
    null,
  )
  assert.ok(encryptionError({ ...settings, showPassword: true, password: '' }))
  assert.throws(() => encryptionOptions({ ...settings, confirmation: '' }))
  assert.equal(encryptionOptions(settings).password, settings.password)
})

async function createArchive(
  enabled: boolean,
  method: 'zipcrypto' | 'aes256' = 'zipcrypto',
) {
  const writer = new ZipWriter(new BlobWriter(), {
    ...encryptionOptions({ ...settings, enabled, method }),
    useWebWorkers: false,
  })
  await writer.add('first.txt', new BlobReader(new Blob(['first contents'])))
  await writer.add('second.txt', new BlobReader(new Blob(['second contents'])))
  return writer.close()
}

async function readArchive(blob: Blob, password?: string) {
  const reader = new ZipReader(new BlobReader(blob), { useWebWorkers: false })
  try {
    const entries = await reader.getEntries()
    const contents: string[] = []
    for (const entry of entries) {
      assert.ok(!entry.directory)
      contents.push(
        await (await entry.getData(new BlobWriter(), { password })).text(),
      )
    }
    return {
      contents,
      encrypted: entries.map((entry) => entry.encrypted),
      zipCrypto: entries.map((entry) => entry.zipCrypto),
    }
  } finally {
    await reader.close()
  }
}

for (const method of ['zipcrypto', 'aes256'] as const) {
  test(`${method}: every entry uses the selected encryption and requires the correct password`, async () => {
    const blob = await createArchive(true, method)
    const result = await readArchive(blob, settings.password)
    assert.deepEqual(result.contents, ['first contents', 'second contents'])
    assert.deepEqual(result.encrypted, [true, true])
    assert.deepEqual(result.zipCrypto, [
      method === 'zipcrypto',
      method === 'zipcrypto',
    ])
    await assert.rejects(readArchive(blob))
    await assert.rejects(readArchive(blob, 'wrong password'))
  })
}

test('turning encryption off produces an archive readable without a password', async () => {
  assert.equal(
    encryptionError({
      ...settings,
      enabled: false,
      password: '',
      confirmation: '',
    }),
    null,
  )
  assert.deepEqual(encryptionOptions({ ...settings, enabled: false }), {})
  const result = await readArchive(await createArchive(false))
  assert.deepEqual(result.contents, ['first contents', 'second contents'])
  assert.deepEqual(result.encrypted, [false, false])
})
