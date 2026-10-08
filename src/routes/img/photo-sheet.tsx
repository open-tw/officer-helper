import { createFileRoute } from '@tanstack/react-router'
import {
  Button,
  Caption1,
  Field,
  Input,
  ProgressBar,
  Select,
  Spinner,
  Text,
  Textarea,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import {
  ArrowDownloadRegular,
  ArrowUpRegular,
  ArrowDownRegular,
  ArrowClockwiseRegular,
  DismissRegular,
  ImageRegular,
  ShieldCheckmarkRegular,
} from '@fluentui/react-icons'
import { useEffect, useRef, useState } from 'react'
import { PageIntro } from '#/components/page-intro'
import { seo } from '#/libs/seo'
import { LIMITS, movePhoto, paginatePhotos } from '#/libs/photo-sheet/model'
import type { PhotoSheet, PhotoSheetPhoto } from '#/libs/photo-sheet/model'

export const Route = createFileRoute('/img/photo-sheet')({
  head: () => ({
    meta: seo({
      title: '照片佐證表',
      description:
        '批次加入照片、排序與填寫說明，自動排成兩欄 A4 照片佐證表。下載固定版面的 PDF、ODT或DOCX，檔案全程在瀏覽器內處理。',
    }),
  }),
  component: RouteComponent,
})

const useStyles = makeStyles({
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(300px, 0.9fr)',
    gap: '24px',
    alignItems: 'start',
    '@media (max-width: 900px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
  },
  stack: { display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 },
  row: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' },
  settings: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '12px',
    '@media (max-width: 480px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
  },
  panel: {
    padding: '20px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorNeutralBackground1,
    minWidth: 0,
  },
  upload: {
    padding: '24px',
    border: `2px dashed ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    textAlign: 'center',
  },
  photos: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '12px',
    padding: 0,
    margin: 0,
    listStyle: 'none',
    '@media (max-width: 480px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
  },
  card: {
    padding: '12px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    minWidth: 0,
  },
  thumb: {
    width: '100%',
    aspectRatio: '1',
    overflow: 'hidden',
    backgroundColor: tokens.colorNeutralBackground3,
  },
  image: { width: '100%', height: '100%', display: 'block' },
  name: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'block',
  },
  muted: { color: tokens.colorNeutralForeground3 },
  preview: {
    position: 'sticky',
    top: '20px',
    '@media (max-width: 900px)': { position: 'static' },
  },
  paper: {
    display: 'block',
    width: '100%',
    height: 'auto',
    boxShadow: tokens.shadow4,
    backgroundColor: '#fff',
  },
  empty: {
    minHeight: '320px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    textAlign: 'center',
    padding: '20px',
    color: tokens.colorNeutralForeground3,
  },
  error: {
    color: tokens.colorPaletteRedForeground1,
    whiteSpace: 'pre-line',
    overflowWrap: 'anywhere',
  },
})

function Thumbnail({ photo }: { photo: PhotoSheetPhoto }) {
  const styles = useStyles()
  const [url, setUrl] = useState('')
  useEffect(() => {
    const next = URL.createObjectURL(photo.image)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [photo.image])
  return (
    <div className={styles.thumb}>
      {url && (
        <img
          className={styles.image}
          src={url}
          alt={photo.name}
          style={{
            objectFit: photo.fit,
            transform: `rotate(${photo.rotation}deg)`,
          }}
        />
      )}
    </div>
  )
}

function PrintPreview({
  sheet,
  page,
  onPage,
}: {
  sheet: PhotoSheet
  page: number
  onPage: (page: number) => void
}) {
  const styles = useStyles()
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [rendering, setRendering] = useState(false)
  const total = paginatePhotos(sheet).length
  useEffect(() => {
    const controller = new AbortController()
    let previewUrl = ''
    setUrl('')
    setError('')
    setRendering(sheet.photos.length > 0)
    if (!sheet.photos.length) return
    const timer = window.setTimeout(async () => {
      let canvas: HTMLCanvasElement | undefined
      try {
        const { renderPhotoSheetPage, canvasBlob } =
          await import('#/libs/photo-sheet/render')
        controller.signal.throwIfAborted()
        canvas = await renderPhotoSheetPage(sheet, page, {
          signal: controller.signal,
        })
        const blob = await canvasBlob(canvas)
        controller.signal.throwIfAborted()
        previewUrl = URL.createObjectURL(blob)
        setUrl(previewUrl)
      } catch (e) {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : '無法產生預覽。')
      } finally {
        if (canvas) canvas.width = canvas.height = 0
        if (!controller.signal.aborted) setRendering(false)
      }
    }, 180)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [sheet, page])
  return (
    <section
      className={`${styles.panel} ${styles.preview} ${styles.stack}`}
      aria-label="PDF 列印預覽"
      aria-busy={rendering}
    >
      <Text as="h2" size={500} weight="semibold">
        PDF 列印預覽
      </Text>
      <Caption1 className={styles.muted}>
        A4 直式・兩欄照片・照片與說明一起分頁
      </Caption1>
      <Caption1 className={styles.muted}>
        此處顯示 PDF 的輸出版面。ODT／DOCX
        可繼續編輯，換行與分頁可能因字型及文書軟體而不同。
      </Caption1>
      {total > 0 && (
        <div className={styles.row}>
          <Button disabled={page === 0} onClick={() => onPage(page - 1)}>
            上一頁
          </Button>
          <Text>
            第 {page + 1}／{total} 頁
          </Text>
          <Button disabled={page >= total - 1} onClick={() => onPage(page + 1)}>
            下一頁
          </Button>
        </div>
      )}
      {error && (
        <div role="alert" className={styles.error}>
          {error}
        </div>
      )}
      {url ? (
        <img
          className={styles.paper}
          src={url}
          alt={`照片佐證表第 ${page + 1} 頁 PDF 列印預覽`}
        />
      ) : (
        <div className={styles.empty}>
          {rendering ? (
            <Spinner label="正在排版…" />
          ) : (
            <>
              <ImageRegular fontSize={40} aria-hidden />
              <Text>
                {error
                  ? '請調整內容後再試。'
                  : '加入照片後，即可預覽 PDF 排版。'}
              </Text>
            </>
          )}
        </div>
      )}
    </section>
  )
}

function RouteComponent() {
  const styles = useStyles()
  const input = useRef<HTMLInputElement>(null)
  const operation = useRef<AbortController | null>(null)
  const [sheet, setSheet] = useState<PhotoSheet>({
    title: '照片佐證表',
    subject: '',
    date: '',
    photosPerPage: 4,
    photos: [],
  })
  const [pageIndex, setPageIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)
  const totalPages = paginatePhotos(sheet).length
  const previewPage = Math.min(pageIndex, Math.max(0, totalPages - 1))
  useEffect(() => () => operation.current?.abort(), [])

  const updatePhoto = (id: string, changes: Partial<PhotoSheetPhoto>) => {
    setSheet((previous) => ({
      ...previous,
      photos: previous.photos.map((photo) =>
        photo.id === id ? { ...photo, ...changes } : photo,
      ),
    }))
    setStatus('')
  }
  const reorder = (id: string, target: number) => {
    setSheet((previous) => ({
      ...previous,
      photos: movePhoto(previous.photos, id, target),
    }))
    setStatus('')
  }
  const pick = async (files: File[]) => {
    if (operation.current || !files.length) return
    const controller = new AbortController()
    operation.current = controller
    setBusy(true)
    setError('')
    setProgress(0)
    setStatus('正在讀取照片…')
    const photos: PhotoSheetPhoto[] = []
    const failures: string[] = []
    try {
      const { preparePhoto } = await import('#/libs/photo-sheet/render')
      for (const [index, file] of files.entries()) {
        controller.signal.throwIfAborted()
        try {
          photos.push(await preparePhoto(file))
        } catch (e) {
          failures.push(
            `${file.name}：${e instanceof Error ? e.message : '無法讀取圖片。'}`,
          )
        }
        controller.signal.throwIfAborted()
        setProgress((index + 1) / files.length)
        setStatus(`正在讀取照片 ${index + 1}／${files.length}…`)
      }
      setSheet((previous) => ({
        ...previous,
        photos: [...previous.photos, ...photos],
      }))
      setError(failures.join('\n'))
      setStatus(
        `已加入 ${photos.length} 張照片${failures.length ? `，${failures.length} 張未能加入` : ''}。`,
      )
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(e instanceof Error ? e.message : '無法讀取照片。')
        setStatus('')
      }
    } finally {
      if (!controller.signal.aborted) {
        operation.current = null
        setBusy(false)
      }
    }
  }
  const download = async (format: 'pdf' | 'odt' | 'docx') => {
    const label = format.toUpperCase()
    if (operation.current || !sheet.photos.length) return
    const controller = new AbortController()
    operation.current = controller
    setBusy(true)
    setProgress(0)
    setError('')
    setStatus(`正在製作 ${label}…`)
    try {
      const exporter =
        format === 'docx'
          ? (await import('#/libs/photo-sheet/docx')).docxExporter
          : format === 'odt'
            ? (await import('#/libs/photo-sheet/odt')).odtExporter
            : (await import('#/libs/photo-sheet/export')).pdfExporter
      const blob = await exporter.export(sheet, {
        signal: controller.signal,
        onProgress: (completed, total) => {
          setProgress(completed / total)
          setStatus(`正在製作 ${label} ${completed}／${total} 頁…`)
        },
      })
      controller.signal.throwIfAborted()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${sheet.title.trim().replace(/[\\/:*?"<>|]/g, '-') || '照片佐證表'}.${exporter.extension}`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setStatus(`已產生 ${label}，開始下載。`)
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(
          e instanceof Error ? e.message : `無法匯出 ${label}，請再試一次。`,
        )
        setStatus('')
      }
    } finally {
      if (!controller.signal.aborted) {
        operation.current = null
        setBusy(false)
      }
    }
  }

  return (
    <>
      <PageIntro
        title="照片佐證表"
        description="加入照片、調整順序並填寫說明，自動排成兩欄 A4 表格。可下載 PDF 直接交付，或下載 ODT／DOCX 繼續編輯。"
      >
        <Caption1 className={styles.muted}>
          <ShieldCheckmarkRegular aria-hidden />{' '}
          照片與說明只在你的瀏覽器內處理，不會上傳。
        </Caption1>
      </PageIntro>
      <div className={styles.layout}>
        <div className={styles.stack}>
          <section
            className={`${styles.panel} ${styles.stack}`}
            aria-label="表單資訊"
          >
            <Text as="h2" size={500} weight="semibold">
              表單資訊
            </Text>
            <Field label="表單標題">
              <Input
                value={sheet.title}
                maxLength={LIMITS.title}
                disabled={busy}
                onChange={(_, data) => {
                  setSheet({ ...sheet, title: data.value })
                  setStatus('')
                }}
              />
            </Field>
            <Field label="案件／活動名稱（選填）">
              <Input
                value={sheet.subject}
                maxLength={LIMITS.subject}
                disabled={busy}
                onChange={(_, data) => {
                  setSheet({ ...sheet, subject: data.value })
                  setStatus('')
                }}
              />
            </Field>
            <div className={styles.settings}>
              <Field label="日期（選填）">
                <Input
                  type="date"
                  value={sheet.date}
                  disabled={busy}
                  onChange={(_, data) => {
                    setSheet({ ...sheet, date: data.value })
                    setStatus('')
                  }}
                />
              </Field>
              <Field label="每頁照片張數">
                <Select
                  value={String(sheet.photosPerPage)}
                  disabled={busy}
                  onChange={(_, data) => {
                    setSheet({
                      ...sheet,
                      photosPerPage: Number(
                        data.value,
                      ) as PhotoSheet['photosPerPage'],
                    })
                    setPageIndex(0)
                    setStatus('')
                  }}
                >
                  <option value="2">2 張（兩欄 × 一列）</option>
                  <option value="4">4 張（兩欄 × 兩列）</option>
                  <option value="6">6 張（兩欄 × 三列）</option>
                </Select>
              </Field>
            </div>
          </section>
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
              hidden
              multiple
              type="file"
              accept="image/jpeg,image/png,image/webp,image/bmp,.jpg,.jpeg,.png,.webp,.bmp"
              onChange={(event) => {
                void pick(Array.from(event.target.files ?? []))
                event.target.value = ''
              }}
            />
            <Button
              icon={<ImageRegular />}
              size="large"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              加入照片
            </Button>
            <p className={styles.muted}>
              可多選或拖曳加入 JPG、PNG、WebP、BMP。DOCX／ODT 保留 JPG、PNG
              格式，WebP、BMP 轉為 PNG。
            </p>
          </div>
          <div className={styles.row}>
            <Text as="h2" size={500} weight="semibold">
              照片與說明（{sheet.photos.length} 張）
            </Text>
            {sheet.photos.length > 0 && (
              <Button
                appearance="subtle"
                disabled={busy}
                onClick={() => {
                  setSheet({ ...sheet, photos: [] })
                  setPageIndex(0)
                  setStatus('已清除全部照片。')
                  setError('')
                }}
              >
                清除全部照片
              </Button>
            )}
          </div>
          <Caption1 className={styles.muted}>
            依序由左到右、由上到下排列。拖曳「排序」按鈕到另一張照片，或使用前移／後移按鈕。
          </Caption1>
          <ol className={styles.photos}>
            {sheet.photos.map((photo, index) => (
              <li
                key={photo.id}
                className={styles.card}
                onDragOver={(event) => {
                  if (
                    !busy &&
                    event.dataTransfer.types.includes(
                      'application/x-photo-sheet',
                    )
                  )
                    event.preventDefault()
                }}
                onDrop={(event) => {
                  const id = event.dataTransfer.getData(
                    'application/x-photo-sheet',
                  )
                  if (busy || !id) return
                  event.preventDefault()
                  event.stopPropagation()
                  reorder(id, index)
                }}
              >
                <div className={styles.row}>
                  <Text weight="semibold">照片 {index + 1}</Text>
                  <Button
                    size="small"
                    disabled={busy}
                    draggable={!busy}
                    aria-label={`拖曳排序照片 ${index + 1}`}
                    onDragStart={(event) => {
                      event.dataTransfer.setData(
                        'application/x-photo-sheet',
                        photo.id,
                      )
                      event.dataTransfer.effectAllowed = 'move'
                    }}
                  >
                    排序
                  </Button>
                  <Button
                    size="small"
                    icon={<DismissRegular />}
                    disabled={busy}
                    aria-label={`移除照片 ${index + 1}`}
                    onClick={() => {
                      setSheet({
                        ...sheet,
                        photos: sheet.photos.filter(
                          (item) => item.id !== photo.id,
                        ),
                      })
                      setStatus('')
                    }}
                  />
                </div>
                <Thumbnail photo={photo} />
                <Caption1 className={styles.name} title={photo.name}>
                  {photo.name}
                </Caption1>
                <div className={styles.row}>
                  <Button
                    icon={<ArrowUpRegular />}
                    size="small"
                    aria-label={`前移照片 ${index + 1}`}
                    disabled={busy || index === 0}
                    onClick={() => reorder(photo.id, index - 1)}
                  />
                  <Button
                    icon={<ArrowDownRegular />}
                    size="small"
                    aria-label={`後移照片 ${index + 1}`}
                    disabled={busy || index === sheet.photos.length - 1}
                    onClick={() => reorder(photo.id, index + 1)}
                  />
                  <Button
                    icon={<ArrowClockwiseRegular />}
                    size="small"
                    aria-label={`旋轉照片 ${index + 1}`}
                    disabled={busy}
                    onClick={() =>
                      updatePhoto(photo.id, {
                        rotation: ((photo.rotation + 90) %
                          360) as PhotoSheetPhoto['rotation'],
                      })
                    }
                  >
                    旋轉
                  </Button>
                </div>
                <Field label={`照片 ${index + 1} 顯示方式`}>
                  <Select
                    value={photo.fit}
                    disabled={busy}
                    onChange={(_, data) =>
                      updatePhoto(photo.id, {
                        fit: data.value as PhotoSheetPhoto['fit'],
                      })
                    }
                  >
                    <option value="contain">完整顯示（不裁切）</option>
                    <option value="cover">填滿裁切（置中）</option>
                  </Select>
                </Field>
                <Field
                  label={`照片 ${index + 1} 說明`}
                  hint={`${photo.caption.length}／${LIMITS.caption} 字`}
                >
                  <Textarea
                    value={photo.caption}
                    maxLength={LIMITS.caption}
                    resize="vertical"
                    disabled={busy}
                    placeholder="例如：舉辦說明會"
                    onChange={(_, data) =>
                      updatePhoto(photo.id, { caption: data.value })
                    }
                  />
                </Field>
              </li>
            ))}
          </ol>
          {error && (
            <div role="alert" className={styles.error}>
              {error}
            </div>
          )}
          <section
            className={`${styles.panel} ${styles.stack}`}
            aria-label="下載文件"
          >
            <Text as="h2" size={500} weight="semibold">
              下載文件
            </Text>
            <div className={styles.stack}>
              <Button
                appearance="primary"
                size="large"
                icon={<ArrowDownloadRegular />}
                disabled={busy || !sheet.photos.length}
                onClick={() => void download('pdf')}
              >
                下載 PDF{totalPages > 0 ? `（${totalPages} 頁）` : ''}
              </Button>
              <Caption1 className={styles.muted}>
                適合直接列印或交付，版面與預覽一致。文字以圖片呈現，無法選取或搜尋。
              </Caption1>
            </div>
            <div className={styles.stack}>
              <Button
                size="large"
                icon={<ArrowDownloadRegular />}
                disabled={busy || !sheet.photos.length}
                onClick={() => void download('odt')}
              >
                下載 ODT
              </Button>
              <Caption1 className={styles.muted}>
                適合使用 LibreOffice，或交付單位指定 ODT
                格式時使用，可修改表格與說明。
              </Caption1>
            </div>
            <div className={styles.stack}>
              <Button
                size="large"
                icon={<ArrowDownloadRegular />}
                disabled={busy || !sheet.photos.length}
                onClick={() => void download('docx')}
              >
                下載 DOCX
              </Button>
              <Caption1 className={styles.muted}>
                適合使用 Microsoft Word，可繼續修改表格與說明，或加入其他報告。
              </Caption1>
            </div>
          </section>
          {busy && <ProgressBar value={progress} aria-label="處理進度" />}
          <div role="status" aria-live="polite">
            {status}
          </div>
        </div>
        <PrintPreview sheet={sheet} page={previewPage} onPage={setPageIndex} />
      </div>
    </>
  )
}
