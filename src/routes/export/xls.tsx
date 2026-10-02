import { PageIntro } from '#/components/page-intro'
import { seo } from '#/libs/seo'
import {
  Button,
  Field,
  Select,
  Spinner,
  Text,
} from '@fluentui/react-components'
import { ArrowDownloadRegular, DocumentRegular } from '@fluentui/react-icons'
import { createFileRoute } from '@tanstack/react-router'
import { useRef, useState } from 'react'

export const Route = createFileRoute('/export/xls')({
  head: () => ({
    meta: [
      ...seo({
        title: 'XLS 轉換工具',
      }),
    ],
  }),
  component: RouteComponent,
})

const TARGETS = [
  { value: 'xlsx', label: 'Excel 活頁簿 (.xlsx)' },
  { value: 'ods', label: 'OpenDocument 試算表 (.ods)' },
  { value: 'csv', label: '逗號分隔值 (.csv)' },
] as const

type Target = (typeof TARGETS)[number]['value']

const ACCEPT = '.xls'

function baseName(name: string) {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(0, dot) : name
}

function RouteComponent() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [statuses, setStatuses] = useState<Map<File, string>>(new Map())
  const [progress, setProgress] = useState('')
  const [target, setTarget] = useState<Target>('xlsx')
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pick = (incoming: FileList | null) => {
    if (busy || !incoming) return
    const selected = Array.from(incoming)
    const valid = selected.filter((file) =>
      file.name.toLowerCase().endsWith('.xls'),
    )
    const rejected = selected.filter(
      (file) => !file.name.toLowerCase().endsWith('.xls'),
    )
    setError(
      rejected.length
        ? `已略過不支援的檔案：${rejected.map((file) => file.name).join('、')}。僅支援 .xls 檔案。`
        : null,
    )
    setFiles((current) => [...current, ...valid])
    setProgress('')
  }

  const download = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = name
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  const convert = async () => {
    if (!files.length || busy) return
    setBusy(true)
    setError(null)
    setStatuses(new Map())
    setProgress('準備轉換…')
    try {
      const XLSX = await import('xlsx')
      const results: { name: string; blob: Blob }[] = []
      const names = new Set<string>()
      for (const [index, file] of files.entries()) {
        setProgress(`正在轉換 ${index + 1} / ${files.length}：${file.name}`)
        setStatuses((current) => new Map(current).set(file, '轉換中'))
        // Let the browser display progress before parsing the next workbook.
        await new Promise((resolve) => window.setTimeout(resolve, 0))
        try {
          const data = await file.arrayBuffer()
          const wb = XLSX.read(data, { type: 'array', cellDates: true })
          const out = XLSX.write(wb, {
            bookType: target,
            type: 'array',
          }) as ArrayBuffer
          const base = baseName(file.name)
          let name = `${base}.${target}`
          let suffix = 2
          while (names.has(name.toLowerCase()))
            name = `${base} (${suffix++}).${target}`
          names.add(name.toLowerCase())
          results.push({
            name,
            blob: new Blob([out], { type: 'application/octet-stream' }),
          })
          setStatuses((current) => new Map(current).set(file, '轉換成功'))
        } catch (e) {
          setStatuses((current) =>
            new Map(current).set(
              file,
              `失敗：${e instanceof Error ? e.message : '請確認檔案格式。'}`,
            ),
          )
        }
      }
      if (results.length) {
        if (files.length === 1) {
          download(results[0].blob, results[0].name)
        } else {
          setProgress('正在打包 ZIP…')
          const { BlobReader, BlobWriter, ZipWriter } =
            await import('@zip.js/zip.js')
          const writer = new ZipWriter(new BlobWriter('application/zip'))
          for (const result of results) {
            await writer.add(result.name, new BlobReader(result.blob))
          }
          download(await writer.close(), `xls-converted-${target}.zip`)
        }
      }
      setProgress(
        `處理完成：${results.length} 個成功，${files.length - results.length} 個失敗。`,
      )
      if (results.length < files.length)
        setError(
          `有 ${files.length - results.length} 個檔案轉換失敗，請查看各檔案的結果。${results.length ? '已開始下載成功轉換的檔案。' : ''}`,
        )
    } catch (e) {
      setProgress('')
      setError(e instanceof Error ? e.message : '轉換或下載失敗，請重試。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ maxWidth: 640, padding: '1rem' }}>
      <PageIntro
        title="XLS 轉換工具"
        description="批次將 .xls 檔案轉換成 .xlsx、.ods 或 .csv，多檔案會打包成 ZIP 下載。"
      />

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        disabled={busy}
        style={{ display: 'none' }}
        onChange={(e) => {
          pick(e.target.files)
          e.target.value = ''
        }}
      />

      <div
        role="button"
        tabIndex={busy ? -1 : 0}
        aria-disabled={busy}
        aria-label="選擇 XLS 檔案，可多選"
        onKeyDown={(e) => {
          if (!busy && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onClick={() => !busy && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          if (!busy) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          pick(e.dataTransfer.files)
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
        <DocumentRegular fontSize={32} />
        <div style={{ marginTop: '0.5rem' }}>
          <Text>點此選擇檔案，或將多個檔案拖曳至此</Text>
        </div>
        <Text size={200}>僅支援 .xls 檔案，可分次追加</Text>
      </div>

      {files.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <Text weight="semibold">已選擇 {files.length} 個檔案</Text>
          <ul style={{ paddingLeft: '1.25rem' }}>
            {files.map((file, index) => (
              <li
                key={index}
                style={{ marginTop: '0.5rem', overflowWrap: 'anywhere' }}
              >
                <Text>{file.name}</Text>{' '}
                <Text size={200}>{statuses.get(file) ?? '待轉換'}</Text>{' '}
                <Button
                  size="small"
                  appearance="subtle"
                  disabled={busy}
                  aria-label={`移除 ${file.name}`}
                  onClick={() => {
                    setFiles((current) => current.filter((_, i) => i !== index))
                    setProgress('')
                  }}
                >
                  移除
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Field label="輸出格式" style={{ marginTop: '1rem' }}>
        <Select
          value={target}
          onChange={(_, d) => setTarget(d.value as Target)}
          disabled={busy}
        >
          {TARGETS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </Field>

      {target === 'csv' && (
        <Text size={200}>CSV 僅輸出每個檔案的第一個工作表，不保留格式。</Text>
      )}

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
          onClick={convert}
          disabled={!files.length || busy}
        >
          {files.length > 1 ? '批次轉換並下載 ZIP' : '轉換並下載'}
        </Button>
        {files.length > 0 && (
          <Button
            appearance="subtle"
            onClick={() => {
              setFiles([])
              setStatuses(new Map())
              setProgress('')
              setError(null)
              if (inputRef.current) inputRef.current.value = ''
            }}
            disabled={busy}
          >
            全部清除
          </Button>
        )}
      </div>

      <div role="status" style={{ marginTop: '0.75rem' }}>
        {progress}
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
          <a href="https://sheetjs.com/" target="_blank" rel="noreferrer">
            sheetjs
          </a>
        </small>
      </p>
    </div>
  )
}
