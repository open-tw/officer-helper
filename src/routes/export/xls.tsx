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
  const [file, setFile] = useState<File | null>(null)
  const [target, setTarget] = useState<Target>('xlsx')
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pick = (next: File | null) => {
    if (next && !next.name.toLowerCase().endsWith('.xls')) {
      setError('僅支援 .xls 檔案。')
      setFile(null)
      return
    }
    setError(null)
    setFile(next)
  }

  const convert = async () => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const XLSX = await import('xlsx')
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data, { type: 'array', cellDates: true })
      const out = XLSX.write(wb, {
        bookType: target,
        type: 'array',
      }) as ArrayBuffer
      const blob = new Blob([out], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${baseName(file.name)}.${target}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : '轉換失敗，請確認檔案格式。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ maxWidth: 640, padding: '1rem' }}>
      <PageIntro
        title="XLS 轉換工具"
        description="把早期 Excel建立的 .xls檔案轉換成 Office 2007之後的 .xlsx檔案 或 OpenDocument Spreadsheet的 .ods檔案"
      />

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        style={{ display: 'none' }}
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
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
          pick(e.dataTransfer.files.item(0))
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
          {file ? (
            <Text weight="semibold">{file.name}</Text>
          ) : (
            <Text>點此選擇檔案，或將檔案拖曳至此</Text>
          )}
        </div>
        <Text size={200}>僅支援 .xls 檔案</Text>
      </div>

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
          disabled={!file || busy}
        >
          轉換並下載
        </Button>
        {file && (
          <Button
            appearance="subtle"
            onClick={() => {
              pick(null)
              if (inputRef.current) inputRef.current.value = ''
            }}
            disabled={busy}
          >
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
          <a href="https://sheetjs.com/" target="_blank" rel="noreferrer">
            sheetjs
          </a>
        </small>
      </p>
    </div>
  )
}
