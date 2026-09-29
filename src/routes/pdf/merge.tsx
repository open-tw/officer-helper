import { createFileRoute } from '@tanstack/react-router'
import {
  Button,
  Caption1,
  Checkbox,
  Field,
  Input,
  Radio,
  RadioGroup,
  Spinner,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import {
  ArrowDownloadRegular,
  ArrowUpRegular,
  ArrowDownRegular,
  DocumentPdfRegular,
  DismissRegular,
  ShieldCheckmarkRegular,
} from '@fluentui/react-icons'
import { useEffect, useRef, useState } from 'react'
import type { MergePage, MergeSource } from '#/libs/pdf-merge'
import { PageIntro } from '#/components/page-intro'
import { seo } from '#/libs/seo'

export const Route = createFileRoute('/pdf/merge')({
  head: () => ({
    meta: seo({
      title: 'PDF 合併',
      description:
        '整份合併 PDF，或選擇指定頁面、調整順序後下載。檔案只在瀏覽器內處理。',
    }),
  }),
  component: RouteComponent,
})

const useStyles = makeStyles({
  stack: { display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 },
  row: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' },
  panel: {
    padding: '20px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  upload: {
    padding: '32px',
    border: `2px dashed ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    textAlign: 'center',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: '12px',
    marginTop: '16px',
  },
  page: {
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: '8px',
    minWidth: 0,
  },
  image: {
    width: '100%',
    height: '180px',
    objectFit: 'contain',
    backgroundColor: tokens.colorNeutralBackground3,
  },
  placeholder: {
    height: '180px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorNeutralBackground3,
  },
  name: { flex: 1, minWidth: '120px', overflowWrap: 'anywhere' },
  muted: { color: tokens.colorNeutralForeground3 },
  list: {
    padding: 0,
    margin: 0,
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  error: {
    whiteSpace: 'pre-line',
    overflowWrap: 'anywhere',
    color: tokens.colorPaletteRedForeground1,
  },
})

const pageKey = (page: MergePage) => `${page.sourceId}:${page.pageIndex}`
function move<T>(items: T[], index: number, delta: number) {
  const result = [...items]
  const target = index + delta
  if (target < 0 || target >= items.length) return items
  ;[result[index], result[target]] = [result[target], result[index]]
  return result
}

function PagePicker({
  source,
  selected,
  disabled,
  toggle,
}: {
  source: MergeSource
  selected: Set<string>
  disabled: boolean
  toggle: (page: MergePage) => void
}) {
  const styles = useStyles()
  const [images, setImages] = useState<string[]>([])
  const [error, setError] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    const isCancelled = () => controller.signal.aborted
    setImages([])
    setError(false)
    let destroy: (() => void) | undefined
    void (async () => {
      try {
        const { loadPdfPreview } = await import('#/libs/pdf-preview')
        const bytes = await source.document.save()
        if (isCancelled()) return
        const task = loadPdfPreview(bytes)
        destroy = () => {
          void task.destroy().catch(() => {})
        }
        const pdf = await task.promise
        for (let index = 1; index <= pdf.numPages; index++) {
          if (isCancelled()) return
          const page = await pdf.getPage(index)
          const natural = page.getViewport({ scale: 1 })
          const viewport = page.getViewport({
            scale: Math.min(240 / natural.width, 300 / natural.height),
          })
          const canvas = document.createElement('canvas')
          canvas.width = Math.ceil(viewport.width)
          canvas.height = Math.ceil(viewport.height)
          await page.render({ canvas, viewport }).promise
          if (isCancelled()) return
          const image = canvas.toDataURL('image/jpeg', 0.75)
          setImages((previous) => [...previous, image])
          canvas.width = canvas.height = 0
          page.cleanup()
        }
      } catch {
        if (!isCancelled()) setError(true)
      } finally {
        destroy?.()
      }
    })()
    return () => {
      controller.abort()
      destroy?.()
    }
  }, [source])
  return (
    <>
      {error && (
        <Caption1 className={styles.muted}>
          部分預覽無法顯示，仍可依頁碼選擇並合併。
        </Caption1>
      )}
      <div className={styles.grid}>
        {Array.from(
          { length: source.document.getPageCount() },
          (_, pageIndex) => {
            const page = { sourceId: source.id, pageIndex }
            return (
              <div key={pageIndex} className={styles.page}>
                {images[pageIndex] ? (
                  <img
                    className={styles.image}
                    src={images[pageIndex]}
                    alt={`${source.name} 第 ${pageIndex + 1} 頁預覽`}
                  />
                ) : (
                  <div className={styles.placeholder}>
                    <DocumentPdfRegular aria-hidden />
                  </div>
                )}
                <Checkbox
                  disabled={disabled}
                  checked={selected.has(pageKey(page))}
                  onChange={() => toggle(page)}
                  label={`第 ${pageIndex + 1} 頁`}
                />
              </div>
            )
          },
        )}
      </div>
    </>
  )
}

function RouteComponent() {
  const styles = useStyles()
  const input = useRef<HTMLInputElement>(null)
  const lock = useRef(false)
  const [sources, setSources] = useState<MergeSource[]>([])
  const [pages, setPages] = useState<MergePage[]>([])
  const [mode, setMode] = useState('whole')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [filename, setFilename] = useState('合併文件')
  const selected = new Set(pages.map(pageKey))
  const wholePages = sources.flatMap((source) =>
    Array.from({ length: source.document.getPageCount() }, (_, pageIndex) => ({
      sourceId: source.id,
      pageIndex,
    })),
  )
  const outputPages = mode === 'whole' ? wholePages : pages

  const pick = async (files: File[]) => {
    if (lock.current || !files.length) return
    lock.current = true
    setBusy(true)
    setError('')
    setStatus('正在讀取 PDF…')
    const added: MergeSource[] = []
    const errors: string[] = []
    try {
      const { readMergeSource } = await import('#/libs/pdf-merge')
      for (const file of files) {
        try {
          if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf')
            throw new Error('請選擇 PDF 檔案。')
          const document = await readMergeSource(await file.arrayBuffer())
          added.push({ id: crypto.randomUUID(), name: file.name, document })
        } catch (e) {
          errors.push(
            `${file.name}：${e instanceof Error ? e.message : '讀取失敗。'}`,
          )
        }
      }
      setSources((previous) => [...previous, ...added])
      setPages((previous) => [
        ...previous,
        ...added.flatMap((source) =>
          Array.from(
            { length: source.document.getPageCount() },
            (_, pageIndex) => ({ sourceId: source.id, pageIndex }),
          ),
        ),
      ])
      setError(errors.join('\n'))
      setStatus(`已加入 ${added.length} 份 PDF。`)
    } catch {
      setError('無法載入 PDF 工具，請重新整理後再試。')
      setStatus('')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  const download = async () => {
    if (lock.current || !outputPages.length) return
    lock.current = true
    setBusy(true)
    setError('')
    setStatus('正在合併 PDF…')
    try {
      const { mergePdfPages } = await import('#/libs/pdf-merge')
      const bytes = await mergePdfPages(sources, outputPages)
      const url = URL.createObjectURL(
        new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }),
      )
      const link = document.createElement('a')
      link.href = url
      link.download = `${
        filename
          .trim()
          .replace(/\.pdf$/i, '')
          .replace(/[\\/:*?"<>|]/g, '-') || '合併文件'
      }.pdf`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setStatus(`已產生 ${outputPages.length} 頁 PDF，開始下載。`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '合併失敗，請再試一次。')
      setStatus('')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  const toggle = (page: MergePage) =>
    setPages((previous) =>
      selected.has(pageKey(page))
        ? previous.filter((item) => pageKey(item) !== pageKey(page))
        : [...previous, page],
    )

  return (
    <>
      <PageIntro
        title="PDF 合併"
        description="整份合併，或挑選需要的頁面，調整順序後合併下載。"
      >
        <Caption1 className={styles.muted}>
          <ShieldCheckmarkRegular aria-hidden />{' '}
          檔案只在你的瀏覽器內處理，不會上傳。
        </Caption1>
      </PageIntro>
      <div className={styles.stack}>
        <Field label="合併方式">
          <RadioGroup
            layout="horizontal"
            value={mode}
            disabled={busy}
            onChange={(_, data) => {
              setMode(data.value)
              setStatus('')
            }}
          >
            <Radio value="whole" label="整份合併" />
            <Radio value="advanced" label="進階：選擇頁面與排序" />
          </RadioGroup>
        </Field>
        <div
          className={styles.upload}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            void pick(Array.from(event.dataTransfer.files))
          }}
        >
          <input
            ref={input}
            type="file"
            multiple
            accept=".pdf,application/pdf"
            hidden
            onChange={(event) => {
              void pick(Array.from(event.target.files ?? []))
              event.target.value = ''
            }}
          />
          <Button
            size="large"
            icon={<DocumentPdfRegular />}
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            選擇 PDF 檔案
          </Button>
          <p className={styles.muted}>
            可一次選擇多份，或將檔案拖曳到這裡；也能繼續加入檔案。
          </p>
        </div>
        {sources.length > 0 && (
          <>
            <div className={styles.row}>
              <Text as="h2" size={500} weight="semibold">
                {mode === 'whole' ? '檔案合併順序' : '選擇頁面'}
              </Text>
              <Button
                disabled={busy}
                appearance="subtle"
                onClick={() => {
                  setSources([])
                  setPages([])
                  setError('')
                  setStatus('已清除全部檔案。')
                }}
              >
                清除全部
              </Button>
            </div>
            <ol className={styles.list}>
              {sources.map((source, index) => (
                <li key={source.id} className={styles.panel}>
                  <div className={styles.row}>
                    <Text className={styles.name} weight="semibold">
                      {index + 1}. {source.name}（
                      {source.document.getPageCount()} 頁）
                    </Text>
                    {mode === 'whole' && (
                      <>
                        <Button
                          icon={<ArrowUpRegular />}
                          aria-label={`上移 ${source.name}`}
                          disabled={busy || index === 0}
                          onClick={() => setSources(move(sources, index, -1))}
                        />
                        <Button
                          icon={<ArrowDownRegular />}
                          aria-label={`下移 ${source.name}`}
                          disabled={busy || index === sources.length - 1}
                          onClick={() => setSources(move(sources, index, 1))}
                        />
                      </>
                    )}
                    {mode === 'advanced' && (
                      <>
                        <Button
                          disabled={busy}
                          onClick={() =>
                            setPages((previous) => [
                              ...previous,
                              ...wholePages.filter(
                                (page) =>
                                  page.sourceId === source.id &&
                                  !selected.has(pageKey(page)),
                              ),
                            ])
                          }
                        >
                          全選
                        </Button>
                        <Button
                          disabled={busy}
                          onClick={() =>
                            setPages((previous) =>
                              previous.filter(
                                (page) => page.sourceId !== source.id,
                              ),
                            )
                          }
                        >
                          取消全選
                        </Button>
                      </>
                    )}
                    <Button
                      icon={<DismissRegular />}
                      aria-label={`移除 ${source.name}`}
                      disabled={busy}
                      onClick={() => {
                        setSources(
                          sources.filter((item) => item.id !== source.id),
                        )
                        setPages(
                          pages.filter((page) => page.sourceId !== source.id),
                        )
                        setStatus('')
                      }}
                    />
                  </div>
                  {mode === 'advanced' && (
                    <PagePicker
                      source={source}
                      selected={selected}
                      disabled={busy}
                      toggle={toggle}
                    />
                  )}
                </li>
              ))}
            </ol>
            {mode === 'advanced' && (
              <section className={styles.stack} aria-label="頁面合併順序">
                <Text as="h2" size={500} weight="semibold">
                  調整頁面順序
                </Text>
                <Caption1>
                  由上到下依序合併，可將不同檔案的頁面交錯排列。重新勾選的頁面會加入最後。
                </Caption1>
                {!pages.length && (
                  <Text>尚未選擇頁面，請先勾選要合併的頁面。</Text>
                )}
                <ol className={styles.list}>
                  {pages.map((page, index) => {
                    const label = `${sources.find((source) => source.id === page.sourceId)?.name} · 第 ${page.pageIndex + 1} 頁`
                    return (
                      <li key={pageKey(page)} className={styles.row}>
                        <Text className={styles.name}>
                          {index + 1}. {label}
                        </Text>
                        <Button
                          icon={<ArrowUpRegular />}
                          aria-label={`上移 ${label}`}
                          disabled={busy || index === 0}
                          onClick={() => setPages(move(pages, index, -1))}
                        />
                        <Button
                          icon={<ArrowDownRegular />}
                          aria-label={`下移 ${label}`}
                          disabled={busy || index === pages.length - 1}
                          onClick={() => setPages(move(pages, index, 1))}
                        />
                        <Button
                          icon={<DismissRegular />}
                          aria-label={`取消選取 ${label}`}
                          disabled={busy}
                          onClick={() => toggle(page)}
                        />
                      </li>
                    )
                  })}
                </ol>
              </section>
            )}
            <Field label="下載檔名" hint="自動加上 .pdf">
              <Input
                value={filename}
                disabled={busy}
                onChange={(_, data) => setFilename(data.value)}
              />
            </Field>
          </>
        )}
        {error && (
          <div role="alert" className={styles.error}>
            {error}
          </div>
        )}
        <div className={styles.row}>
          <Button
            appearance="primary"
            size="large"
            icon={<ArrowDownloadRegular />}
            disabled={busy || !outputPages.length}
            onClick={() => void download()}
          >
            合併並下載（{outputPages.length} 頁）
          </Button>
          {busy && <Spinner size="tiny" />}
        </div>
        <div role="status" aria-live="polite">
          {status}
        </div>
      </div>
    </>
  )
}
