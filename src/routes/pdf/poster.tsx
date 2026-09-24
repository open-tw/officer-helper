import { createFileRoute } from '@tanstack/react-router'
import {
  Body1,
  Button,
  Caption1,
  Checkbox,
  Field,
  ProgressBar,
  Radio,
  RadioGroup,
  Select,
  Spinner,
  Subtitle2,
  Text,
  makeStyles,
  mergeClasses,
  tokens,
} from '@fluentui/react-components'
import {
  ArrowDownloadRegular,
  DocumentPdfRegular,
  PrintRegular,
  ShieldCheckmarkRegular,
} from '@fluentui/react-icons'
import { useEffect, useRef, useState } from 'react'
import type { PDFDocument } from 'pdf-lib'
import type { PDFDocumentLoadingTask } from 'pdfjs-dist'
import { PageIntro } from '#/components/page-intro'
import { seo } from '#/libs/seo'
import { MM } from '#/libs/poster-layout'
import type {
  PosterAssembly,
  PosterCount,
  PosterLayout,
  PosterPaper,
} from '#/libs/poster-layout'

export const Route = createFileRoute('/pdf/poster')({
  head: () => ({
    meta: seo({
      title: '海報分割列印',
      description:
        '將 PDF 放大分割成多張 A4 或 A3，列印後拼成海報。檔案只在瀏覽器內處理。',
    }),
  }),
  component: RouteComponent,
})

const useStyles = makeStyles({
  layout: {
    display: 'grid',
    gridTemplateColumns: '280px minmax(0, 1fr)',
    gap: tokens.spacingHorizontalXXL,
    alignItems: 'start',
    '@media (max-width: 760px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalXL,
    minWidth: 0,
  },
  dropzone: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    rowGap: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalXL,
    border: `${tokens.strokeWidthThick} dashed ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    textAlign: 'center',
    cursor: 'pointer',
    backgroundColor: tokens.colorNeutralBackground1,
    ':hover': { backgroundColor: tokens.colorNeutralBackground1Hover },
    ':focus-visible': {
      outline: `2px solid ${tokens.colorBrandStroke1}`,
      outlineOffset: '3px',
    },
  },
  dragging: {
    borderTopColor: tokens.colorBrandStroke1,
    borderRightColor: tokens.colorBrandStroke1,
    borderBottomColor: tokens.colorBrandStroke1,
    borderLeftColor: tokens.colorBrandStroke1,
    backgroundColor: tokens.colorBrandBackground2,
  },
  icon: { fontSize: '36px', color: tokens.colorBrandForeground1 },
  filename: { overflowWrap: 'anywhere' },
  muted: { color: tokens.colorNeutralForeground3 },
  privacy: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalXS,
    color: tokens.colorNeutralForeground3,
  },
  instructions: {
    padding: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorBrandBackground2,
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalS,
  },
  preview: {
    minWidth: 0,
    padding: tokens.spacingHorizontalL,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  previewHeader: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalXS,
    marginBottom: tokens.spacingVerticalL,
  },
  empty: {
    minHeight: '340px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: tokens.spacingVerticalM,
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
  },
  grid: {
    display: 'grid',
    gap: tokens.spacingHorizontalM,
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  tile: { margin: 0, minWidth: 0 },
  image: {
    display: 'block',
    width: '100%',
    height: 'auto',
    boxShadow: tokens.shadow4,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  caption: {
    display: 'block',
    marginTop: tokens.spacingVerticalXS,
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
  },
  footer: {
    display: 'block',
    marginTop: tokens.spacingVerticalL,
    color: tokens.colorNeutralForeground3,
  },
  error: {
    padding: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorPaletteRedBackground1,
    color: tokens.colorPaletteRedForeground1,
    overflowWrap: 'anywhere',
  },
})

type Source = { document: PDFDocument; name: string; id: number }
type Result = {
  key: string
  bytes: Uint8Array
  layout: PosterLayout
  images: string[]
}

function RouteComponent() {
  const styles = useStyles()
  const inputRef = useRef<HTMLInputElement>(null)
  const loadId = useRef(0)
  const [source, setSource] = useState<Source | null>(null)
  const [pageIndex, setPageIndex] = useState(0)
  const [paper, setPaper] = useState<PosterPaper>('A4')
  const [count, setCount] = useState<PosterCount>(2)
  const [assembly, setAssembly] = useState<PosterAssembly>('direct')
  const [showMarks, setShowMarks] = useState(true)
  const [dragging, setDragging] = useState(false)
  const [reading, setReading] = useState(false)
  const [readError, setReadError] = useState<string | null>(null)
  const [buildError, setBuildError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [progress, setProgress] = useState(0)
  const key = `${source?.id}-${pageIndex}-${paper}-${count}-${assembly}-${showMarks}`
  const ready = result?.key === key ? result : null
  const busy = !!source && !ready && !buildError

  useEffect(
    () => () => {
      loadId.current++
    },
    [],
  )

  const pick = async (file: File | undefined) => {
    if (!file) return
    const id = ++loadId.current
    setSource(null)
    setResult(null)
    setReadError(null)
    setBuildError(null)
    setPageIndex(0)
    setReading(false)
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      setReadError('請選擇 PDF 檔案。')
      return
    }
    setReading(true)
    try {
      const { readPosterSource } = await import('#/libs/pdf-poster')
      const document = await readPosterSource(await file.arrayBuffer())
      if (id === loadId.current) setSource({ document, name: file.name, id })
    } catch (error) {
      if (id === loadId.current)
        setReadError(
          error instanceof Error ? error.message : '無法讀取 PDF，請再試一次。',
        )
    } finally {
      if (id === loadId.current) setReading(false)
    }
  }

  useEffect(() => {
    setBuildError(null)
    setProgress(0)
    if (!source) return
    const controller = new AbortController()
    const isCancelled = () => controller.signal.aborted
    let loadingTask: PDFDocumentLoadingTask | undefined
    const timer = window.setTimeout(async () => {
      try {
        const { createPoster } = await import('#/libs/pdf-poster')
        if (isCancelled()) return
        const generated = await createPoster(
          source.document,
          pageIndex,
          paper,
          count,
          { assembly, showMarks },
        )
        if (isCancelled()) return
        const { loadPdfPreview } = await import('#/libs/pdf-preview')
        if (isCancelled()) return
        loadingTask = loadPdfPreview(generated.bytes)
        const pdf = await loadingTask.promise
        const images: string[] = []
        for (let index = 1; index <= pdf.numPages; index++) {
          if (isCancelled()) return
          const page = await pdf.getPage(index)
          const natural = page.getViewport({ scale: 1 })
          const viewport = page.getViewport({ scale: 600 / natural.width })
          const canvas = document.createElement('canvas')
          canvas.width = Math.ceil(viewport.width)
          canvas.height = Math.ceil(viewport.height)
          await page.render({ canvas, viewport, intent: 'print' }).promise
          if (isCancelled()) return
          images.push(canvas.toDataURL('image/png'))
          canvas.width = canvas.height = 0
          page.cleanup()
          setProgress(index / pdf.numPages)
        }
        if (!isCancelled()) setResult({ ...generated, key, images })
      } catch (error) {
        if (!isCancelled())
          setBuildError(
            error instanceof Error
              ? `無法製作海報：${error.message}`
              : '無法製作海報，請換一份 PDF 再試一次。',
          )
      } finally {
        if (loadingTask) {
          void loadingTask.destroy().catch(() => {})
          loadingTask = undefined
        }
      }
    }, 150)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
      if (loadingTask) {
        void loadingTask.destroy().catch(() => {})
        loadingTask = undefined
      }
    }
  }, [source, pageIndex, paper, count, assembly, showMarks, key])

  const clear = () => {
    loadId.current++
    setSource(null)
    setReading(false)
    setResult(null)
    setReadError(null)
    setBuildError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const download = () => {
    if (!ready || !source) return
    const url = URL.createObjectURL(
      new Blob([new Uint8Array(ready.bytes)], { type: 'application/pdf' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = `${source.name.replace(/\.pdf$/i, '')}-第${pageIndex + 1}頁-海報-${paper}-${count}張.pdf`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const error = readError || buildError
  return (
    <>
      <PageIntro
        title="海報分割列印"
        description="選擇紙張和張數，把 PDF 放大印出來，再拼成一張海報。"
      >
        <Caption1 className={styles.privacy}>
          <ShieldCheckmarkRegular aria-hidden />
          檔案只在你的瀏覽器內處理，不會上傳。
        </Caption1>
      </PageIntro>
      <div className={styles.layout}>
        <div className={styles.form}>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            hidden
            onChange={(event) => {
              void pick(event.target.files?.[0])
              event.target.value = ''
            }}
          />
          <div
            role="button"
            tabIndex={0}
            aria-label="選擇 PDF 檔案"
            className={mergeClasses(
              styles.dropzone,
              dragging && styles.dragging,
            )}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                inputRef.current?.click()
              }
            }}
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(false)
              void pick(event.dataTransfer.files[0])
            }}
          >
            {reading ? (
              <Spinner size="small" label="讀取 PDF 中" />
            ) : (
              <DocumentPdfRegular className={styles.icon} aria-hidden />
            )}
            <Text weight="semibold" className={styles.filename}>
              {source ? source.name : '選擇 PDF 檔案'}
            </Text>
            <Caption1 className={styles.muted}>
              {source
                ? `共 ${source.document.getPageCount()} 頁 · 點此更換檔案`
                : '也可以把檔案拖曳到這裡'}
            </Caption1>
          </div>
          {source && source.document.getPageCount() > 1 && (
            <Field label="要放大哪一頁？">
              <Select
                value={String(pageIndex)}
                onChange={(_, data) => setPageIndex(Number(data.value))}
              >
                {Array.from(
                  { length: source.document.getPageCount() },
                  (_, index) => (
                    <option key={index} value={index}>
                      第 {index + 1} 頁
                    </option>
                  ),
                )}
              </Select>
            </Field>
          )}
          <Field label="用什麼紙印？">
            <RadioGroup
              layout="horizontal"
              value={paper}
              onChange={(_, data) => setPaper(data.value as PosterPaper)}
            >
              <Radio value="A4" label="A4" />
              <Radio value="A3" label="A3" />
            </RadioGroup>
          </Field>
          <Field
            label="用幾張紙拼？"
            hint="張數越多，海報越大。方向與比例會自動安排。"
          >
            <RadioGroup
              layout="horizontal"
              value={String(count)}
              onChange={(_, data) =>
                setCount(Number(data.value) as PosterCount)
              }
            >
              {[2, 4, 8].map((value) => (
                <Radio
                  key={value}
                  value={String(value)}
                  label={`${value} 張`}
                />
              ))}
            </RadioGroup>
          </Field>
          <Field
            label="怎麼拼貼？"
            hint={
              assembly === 'direct'
                ? '不用剪裁，紙張靠邊排列即可。接縫會保留白邊。'
                : '剪掉白邊，利用重疊的圖案對齊，讓畫面連接起來。'
            }
          >
            <RadioGroup
              value={assembly}
              onChange={(_, data) => setAssembly(data.value as PosterAssembly)}
            >
              <Radio value="direct" label="直接拼貼（免裁切）" />
              <Radio value="trim" label="裁切後拼貼" />
            </RadioGroup>
          </Field>
          {assembly === 'trim' && (
            <Checkbox
              checked={showMarks}
              onChange={(_, data) => setShowMarks(data.checked === true)}
              label="顯示裁切標記與拼接編號"
            />
          )}
          {error && (
            <div role="alert" className={styles.error}>
              {error}
            </div>
          )}
          <Button
            appearance="primary"
            size="large"
            icon={<ArrowDownloadRegular />}
            disabled={!ready}
            onClick={download}
          >
            下載列印 PDF
          </Button>
          {(source || reading || error) && (
            <Button appearance="subtle" onClick={clear}>
              清除檔案
            </Button>
          )}
          <div className={styles.instructions}>
            <Text weight="semibold">
              <PrintRegular aria-hidden /> 列印時這樣選
            </Text>
            <Body1>{paper} 紙張、實際大小（100%）、單面列印。</Body1>
            <Caption1>
              {assembly === 'direct'
                ? '按照預覽順序，將紙張靠邊排列，從背面貼好即可；接縫會留有白邊。'
                : `${showMarks ? '沿裁切標記' : ''}去掉白邊，再將相鄰頁面重複的圖案對齊黏貼。`}
            </Caption1>
          </div>
        </div>
        <section
          className={styles.preview}
          aria-label="海報拼接預覽"
          aria-busy={busy || reading}
        >
          <div className={styles.previewHeader}>
            <Subtitle2 as="h2">拼起來的樣子</Subtitle2>
            <Caption1 className={styles.muted}>
              由左到右、由上到下，依預覽順序拼接。
            </Caption1>
          </div>
          <div role="status" aria-live="polite">
            {ready && (
              <Caption1 className={styles.footer}>
                已準備好 {count} 張 {paper}，可以下載列印。
              </Caption1>
            )}
            {(busy || reading) && (
              <div className={styles.empty}>
                <Spinner
                  label={reading ? '正在讀取檔案…' : '正在製作列印預覽…'}
                />
                {busy && (
                  <ProgressBar value={progress} style={{ width: '70%' }} />
                )}
              </div>
            )}
          </div>
          {ready ? (
            <>
              <ol
                className={styles.grid}
                style={{
                  gridTemplateColumns: `repeat(${ready.layout.columns}, minmax(0, 1fr))`,
                  marginTop: '1rem',
                }}
              >
                {ready.images.map((image, index) => (
                  <li key={index} className={styles.tile}>
                    <img
                      className={styles.image}
                      src={image}
                      alt={`第 ${index + 1} 張，位於第 ${Math.floor(index / ready.layout.columns) + 1} 排、第 ${(index % ready.layout.columns) + 1} 欄`}
                      width={ready.layout.pageWidth}
                      height={ready.layout.pageHeight}
                    />
                    <Caption1 className={styles.caption}>
                      第 {index + 1} 張
                    </Caption1>
                  </li>
                ))}
              </ol>
              <Caption1 className={styles.footer}>
                內容約 {Math.round(ready.layout.contentWidth / MM) / 10} ×{' '}
                {Math.round(ready.layout.contentHeight / MM) / 10} 公分 ·{' '}
                {count} 張 {paper}（
                {ready.layout.pageWidth > ready.layout.pageHeight
                  ? '橫式'
                  : '直式'}
                ）
              </Caption1>
              <Caption1 className={styles.footer}>
                {assembly === 'direct'
                  ? '不印裁切標記、不重複圖案；紙張白邊會留在接縫處。'
                  : '已自動保留白邊與黏貼重疊區。'}
                預覽中的每張紙就是下載後的 PDF 頁面。
              </Caption1>
            </>
          ) : (
            !busy &&
            !reading && (
              <div className={styles.empty}>
                <PrintRegular className={styles.icon} aria-hidden />
                <Body1>
                  {error
                    ? '請調整設定或更換 PDF 後再試一次。'
                    : '放入 PDF，就能看到拼接預覽。'}
                </Body1>
                <Caption1>不用計算放大比例，也不用設定切割位置。</Caption1>
              </div>
            )
          )}
        </section>
      </div>
    </>
  )
}
