import { seo } from '#/libs/seo'
import { Button, Field, Input, Spinner, Text } from '@fluentui/react-components'
import {
  ArrowDownloadRegular,
  DeleteRegular,
  FolderZipRegular,
} from '@fluentui/react-icons'
import { createFileRoute } from '@tanstack/react-router'
import { useRef, useState } from 'react'

export const Route = createFileRoute('/zip')({
  head: () => ({
    meta: [
      ...seo({
        title: '壓一起',
      }),
    ],
  }),
  component: RouteComponent,
})

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fileKey(f: File) {
  return `${f.name}-${f.size}-${f.lastModified}`
}

function RouteComponent() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [zipName, setZipName] = useState('archive')
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const addFiles = (list: FileList | File[] | null) => {
    if (!list) return
    const incoming = Array.from(list)
    if (incoming.length === 0) return
    setError(null)
    setFiles((prev) => {
      const seen = new Set(prev.map(fileKey))
      const next = [...prev]
      for (const f of incoming) {
        const k = fileKey(f)
        if (!seen.has(k)) {
          seen.add(k)
          next.push(f)
        }
      }
      return next
    })
  }

  const removeFile = (idx: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== idx))

  const clear = () => {
    setFiles([])
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const compress = async () => {
    if (files.length === 0) return
    setBusy(true)
    setError(null)
    setProgress(0)
    try {
      const { BlobReader, BlobWriter, ZipWriter } = await import(
        '@zip.js/zip.js'
      )
      const writer = new ZipWriter(new BlobWriter('application/zip'))
      const total = files.reduce((sum, f) => sum + f.size, 0) || 1
      let done = 0
      for (const f of files) {
        let last = 0
        await writer.add(f.name, new BlobReader(f), {
          lastModDate: new Date(f.lastModified),
          onprogress: (p) => {
            done += p - last
            last = p
            setProgress(Math.min(100, Math.round((done / total) * 100)))
          },
        })
      }
      const blob = await writer.close()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${zipName.trim() || 'archive'}.zip`
      a.click()
      URL.revokeObjectURL(url)
      setProgress(100)
    } catch (e) {
      setError(e instanceof Error ? e.message : '壓縮失敗，請再試一次。')
    } finally {
      setBusy(false)
    }
  }

  const totalSize = files.reduce((sum, f) => sum + f.size, 0)

  return (
    <div style={{ maxWidth: 640, padding: '1rem' }}>
      <h1>壓一起</h1>
      <p>選擇多個檔案，在瀏覽器內打包成一個 .zip 檔案下載。</p>

      <input
        ref={inputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          addFiles(e.target.files)
          e.target.value = ''
        }}
      />

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          addFiles(e.dataTransfer.files)
        }}
        style={{
          marginTop: '1rem',
          padding: '2rem 1rem',
          border: `2px dashed ${dragging ? '#0f6cbd' : '#d1d1d1'}`,
          borderRadius: 8,
          textAlign: 'center',
          cursor: 'pointer',
          background: dragging ? '#f3f9fd' : 'transparent',
        }}
      >
        <FolderZipRegular fontSize={32} />
        <div style={{ marginTop: '0.5rem' }}>
          <Text>點此選擇檔案，或將檔案拖曳至此（可多選）</Text>
        </div>
      </div>

      {files.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: '1rem 0 0',
            border: '1px solid #e0e0e0',
            borderRadius: 8,
          }}
        >
          {files.map((f, i) => (
            <li
              key={fileKey(f)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 0.75rem',
                borderTop: i === 0 ? 'none' : '1px solid #e0e0e0',
              }}
            >
              <Text
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {f.name}
              </Text>
              <Text size={200}>{formatSize(f.size)}</Text>
              <Button
                appearance="subtle"
                size="small"
                icon={<DeleteRegular />}
                aria-label="移除"
                onClick={() => removeFile(i)}
                disabled={busy}
              />
            </li>
          ))}
          <li
            style={{
              padding: '0.5rem 0.75rem',
              borderTop: '1px solid #e0e0e0',
              textAlign: 'right',
            }}
          >
            <Text size={200}>
              共 {files.length} 個檔案，{formatSize(totalSize)}
            </Text>
          </li>
        </ul>
      )}

      <Field label="壓縮檔名稱" style={{ marginTop: '1rem' }}>
        <Input
          value={zipName}
          onChange={(_, d) => setZipName(d.value)}
          contentAfter={<Text size={200}>.zip</Text>}
          disabled={busy}
        />
      </Field>

      <div
        style={{
          marginTop: '1rem',
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center',
        }}
      >
        <Button
          appearance="primary"
          icon={busy ? <Spinner size="tiny" /> : <ArrowDownloadRegular />}
          onClick={compress}
          disabled={files.length === 0 || busy}
        >
          {busy ? `壓縮中 ${progress}%` : '壓縮並下載'}
        </Button>
        {files.length > 0 && (
          <Button appearance="subtle" onClick={clear} disabled={busy}>
            清除
          </Button>
        )}
      </div>

      {error && (
        <Text
          style={{ display: 'block', marginTop: '0.75rem', color: '#b10e1c' }}
        >
          {error}
        </Text>
      )}

      <p style={{ marginTop: '2rem' }}>
        <small>
          檔案僅在瀏覽器內處理，不會上傳。本工具依靠
          <a
            href="https://github.com/gildas-lormeau/zip.js"
            target="_blank"
            rel="noreferrer"
          >
            zip.js
          </a>
        </small>
      </p>
    </div>
  )
}
