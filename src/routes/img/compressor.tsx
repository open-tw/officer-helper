import { PageIntro } from '#/components/page-intro'
import { seo } from '#/libs/seo'
import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Body1,
  Button,
  Caption1,
  Field,
  Input,
  List,
  ListItem,
  ProgressBar,
  Radio,
  RadioGroup,
  Select,
  Slider,
  Spinner,
  Text,
  makeStyles,
  mergeClasses,
  tokens,
} from '@fluentui/react-components'
import {
  ArrowDownloadRegular,
  DismissRegular,
  ImageRegular,
} from '@fluentui/react-icons'
import { createFileRoute } from '@tanstack/react-router'
// Web Worker 內是用 importScripts 載入套件，預設會抓 jsDelivr 的 CDN。
// 改指到自己站上的副本，內網也能用，也不會有對外連線。
// importScripts 只吃 classic script，所以要用 .js（UMD）而不是 .mjs。
import compressionLibUrl from 'browser-image-compression/dist/browser-image-compression.js?url'
import { useEffect, useRef, useState } from 'react'

export const Route = createFileRoute('/img/compressor')({
  head: () => ({
    meta: [
      ...seo({
        title: '圖片壓縮',
        description:
          '在瀏覽器直接壓縮圖片，縮小檔案大小方便寄送或上傳，照片不會上傳到伺服器。',
      }),
    ],
  }),
  component: RouteComponent,
})

/* ------------------------------------------------------------------ */
/* 設定值                                                              */
/* ------------------------------------------------------------------ */

type PresetValue = 'extreme' | 'normal' | 'quality' | 'custom'

const PRESETS: {
  value: Exclude<PresetValue, 'custom'>
  label: string
  hint: string
  maxSizeMB: number
  maxWidthOrHeight: number
  initialQuality: number
}[] = [
  {
    value: 'extreme',
    label: '極致壓縮',
    hint: '檔案最小、畫質最低，適合只在螢幕上看',
    maxSizeMB: 0.15,
    maxWidthOrHeight: 720,
    initialQuality: 0.7,
  },
  {
    value: 'normal',
    label: '一般壓縮',
    hint: '檔案明顯縮小，螢幕上看仍然清晰，適合夾帶信件或上傳',
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    initialQuality: 0.75,
  },
  {
    value: 'quality',
    label: '保留畫質',
    hint: '畫質損失最少，適合列印或存檔',
    maxSizeMB: 3,
    maxWidthOrHeight: 2560,
    initialQuality: 0.85,
  },
]

const SIZE_LIMITS = [
  { value: 0, label: '不縮小尺寸' },
  { value: 720, label: '長邊 720 px' },
  { value: 1280, label: '長邊 1280 px' },
  { value: 1920, label: '長邊 1920 px（Full HD）' },
  { value: 2560, label: '長邊 2560 px' },
  { value: 4096, label: '長邊 4096 px' },
] as const

const FORMATS = [
  { value: '', label: '維持原格式' },
  { value: 'image/jpeg', label: 'JPEG（相容性最好）' },
  { value: 'image/webp', label: 'WebP（檔案更小，部分舊系統不支援）' },
] as const

const ACCEPTED = 'image/jpeg,image/png,image/webp,image/gif,image/bmp'

/* ------------------------------------------------------------------ */
/* 工具函式                                                            */
/* ------------------------------------------------------------------ */

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fileKey(f: File) {
  return `${f.name}-${f.size}-${f.lastModified}`
}

/** 轉檔時要把副檔名換掉，不然 photo.png 裡面裝的其實是 JPEG */
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/png': 'png',
}

function renameByType(name: string, type: string) {
  const ext = EXTENSIONS[type]
  if (!ext) return name
  const base = name.replace(/\.[^.]+$/, '')
  return `${base}.${ext}`
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** iPhone 的 HEIC 瀏覽器解不開，要給明確指示而不是「壓縮失敗」 */
function isHeic(file: File) {
  return /\.hei[cf]$/i.test(file.name) || /hei[cf]/i.test(file.type)
}

type Status = 'pending' | 'working' | 'done' | 'skipped' | 'error'

type Item = {
  key: string
  file: File
  preview: string
  status: Status
  /** 壓縮結果，尚未完成或失敗時為 null */
  output: File | null
  message?: string
}

/* ------------------------------------------------------------------ */
/* 樣式                                                                */
/* ------------------------------------------------------------------ */

const useStyles = makeStyles({
  form: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalL,
  },
  dropzone: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    rowGap: tokens.spacingVerticalS,
    padding: `${tokens.spacingVerticalXXXL} ${tokens.spacingHorizontalL}`,
    border: `${tokens.strokeWidthThick} dashed ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    textAlign: 'center',
    cursor: 'pointer',
    color: tokens.colorNeutralForeground3,
    ':hover': {
      borderTopColor: tokens.colorNeutralStroke1,
      borderRightColor: tokens.colorNeutralStroke1,
      borderBottomColor: tokens.colorNeutralStroke1,
      borderLeftColor: tokens.colorNeutralStroke1,
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  dropzoneCompact: {
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalL}`,
  },
  dropzoneActive: {
    borderTopColor: tokens.colorBrandStroke1,
    borderRightColor: tokens.colorBrandStroke1,
    borderBottomColor: tokens.colorBrandStroke1,
    borderLeftColor: tokens.colorBrandStroke1,
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
  },
  dropIcon: {
    fontSize: '40px',
  },
  presetHint: {
    color: tokens.colorNeutralForeground3,
  },
  radioGroup: {
    flexWrap: 'wrap',
  },
  radio: {
    whiteSpace: 'nowrap',
  },
  customFields: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalS,
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  spacer: {
    flex: 1,
  },
  list: {
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    overflow: 'hidden',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalM,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    // 列與列之間只留一條細線，第一列不用
    ':not(:first-child)': {
      borderTop: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    },
  },
  thumb: {
    flexShrink: 0,
    width: '48px',
    height: '48px',
    objectFit: 'cover',
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalXXS,
  },
  name: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  sizes: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalXS,
    color: tokens.colorNeutralForeground3,
  },
  saved: {
    color: tokens.colorPaletteGreenForeground1,
    fontWeight: tokens.fontWeightSemibold,
  },
  failed: {
    color: tokens.colorPaletteRedForeground1,
  },
  summary: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: tokens.spacingHorizontalS,
    rowGap: tokens.spacingVerticalXS,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalM}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  privacy: {
    marginTop: tokens.spacingVerticalXXL,
    color: tokens.colorNeutralForeground3,
  },
})

/* ------------------------------------------------------------------ */
/* 元件                                                                */
/* ------------------------------------------------------------------ */

function RouteComponent() {
  const styles = useStyles()
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const cancelledRef = useRef(false)

  const [items, setItems] = useState<Item[]>([])
  const [preset, setPreset] = useState<PresetValue>('normal')
  const [maxSizeMB, setMaxSizeMB] = useState('1')
  const [maxWidthOrHeight, setMaxWidthOrHeight] = useState<number>(1920)
  const [quality, setQuality] = useState(0.75)
  const [format, setFormat] = useState<string>('')
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [current, setCurrent] = useState(0)
  const [percent, setPercent] = useState(0)

  // 離開頁面時釋放縮圖的 object URL
  const itemsRef = useRef(items)
  itemsRef.current = items
  useEffect(
    () => () => {
      for (const it of itemsRef.current) URL.revokeObjectURL(it.preview)
    },
    [],
  )

  const addFiles = (list: FileList | File[] | null) => {
    if (!list) return
    const incoming = Array.from(list).filter((f) => f.type.startsWith('image/'))
    if (incoming.length === 0) return
    setItems((prev) => {
      const seen = new Set(prev.map((i) => i.key))
      const next = [...prev]
      for (const file of incoming) {
        const key = fileKey(file)
        if (seen.has(key)) continue
        seen.add(key)
        next.push({
          key,
          file,
          preview: URL.createObjectURL(file),
          status: 'pending',
          output: null,
        })
      }
      return next
    })
  }

  const removeItem = (key: string) =>
    setItems((prev) => {
      const target = prev.find((i) => i.key === key)
      if (target) URL.revokeObjectURL(target.preview)
      return prev.filter((i) => i.key !== key)
    })

  const clearAll = () => {
    for (const it of items) URL.revokeObjectURL(it.preview)
    setItems([])
    setCurrent(0)
    setPercent(0)
    if (inputRef.current) inputRef.current.value = ''
  }

  const patch = (key: string, next: Partial<Item>) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...next } : i)))

  const activePreset = PRESETS.find((p) => p.value === preset)
  const pendingCount = items.filter((i) => i.status === 'pending').length
  const finished = items.filter((i) => i.output !== null)
  const totalIn = finished.reduce((s, i) => s + i.file.size, 0)
  const totalOut = finished.reduce((s, i) => s + (i.output?.size ?? 0), 0)
  const totalSaved =
    totalIn > 0 ? Math.round((1 - totalOut / totalIn) * 100) : 0

  const run = async () => {
    const queue = items.filter((i) => i.status === 'pending')
    if (queue.length === 0) return
    const controller = new AbortController()
    abortRef.current = controller
    cancelledRef.current = false
    setBusy(true)
    try {
      const imageCompression = (await import('browser-image-compression'))
        .default
      // 一次壓一張，避免多張大圖同時佔用記憶體
      for (const [idx, item] of queue.entries()) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- 取消是非同步發生的，型別推斷看不到
        if (cancelledRef.current) break
        setCurrent(idx + 1)
        setPercent(0)
        patch(item.key, { status: 'working' })
        try {
          const output = await imageCompression(item.file, {
            maxSizeMB: Number(maxSizeMB) || 1,
            maxWidthOrHeight: maxWidthOrHeight || undefined,
            initialQuality: quality,
            fileType: format || undefined,
            useWebWorker: true,
            // worker 是 blob: 來源，相對路徑解析不到，要給絕對網址
            libURL: new URL(compressionLibUrl, location.href).href,
            preserveExif: true,
            signal: controller.signal,
            onProgress: setPercent,
          })
          // 壓完反而變大就保留原檔，不要給使用者更大的檔案
          patch(
            item.key,
            output.size >= item.file.size
              ? {
                  status: 'skipped',
                  output: item.file,
                  message: '已是最小，維持原檔',
                }
              : { status: 'done', output },
          )
        } catch (e) {
          // 取消時套件會丟錯，這時把狀態退回待壓縮而不是標成失敗
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- 同上
          if (cancelledRef.current) {
            patch(item.key, { status: 'pending' })
            break
          }
          patch(item.key, {
            status: 'error',
            message: isHeic(item.file)
              ? '瀏覽器無法讀取 HEIC，請先在手機上轉成 JPG'
              : e instanceof Error
                ? e.message
                : '壓縮失敗',
          })
        }
      }
    } finally {
      abortRef.current = null
      setBusy(false)
      setCurrent(0)
      setPercent(0)
    }
  }

  const cancel = () => {
    cancelledRef.current = true
    abortRef.current?.abort()
  }

  const downloadOne = (item: Item) => {
    if (!item.output) return
    downloadBlob(item.output, renameByType(item.file.name, item.output.type))
  }

  const downloadAll = async () => {
    if (finished.length === 1) {
      downloadOne(finished[0])
      return
    }
    const { BlobReader, BlobWriter, ZipWriter } = await import('@zip.js/zip.js')
    const writer = new ZipWriter(new BlobWriter('application/zip'))
    const used = new Set<string>()
    for (const item of finished) {
      if (!item.output) continue
      // 同名檔案在 zip 裡要加序號，不然會覆蓋掉
      let name = renameByType(item.file.name, item.output.type)
      for (let n = 2; used.has(name); n++) {
        name = name.replace(/(\.[^.]+)$/, `-${n}$1`)
      }
      used.add(name)
      await writer.add(name, new BlobReader(item.output))
    }
    downloadBlob(await writer.close(), '壓縮圖片.zip')
  }

  return (
    <>
      <PageIntro
        title="圖片壓縮"
        description="選擇圖片後在瀏覽器直接壓縮，檔案不會上傳到伺服器。"
      />

      <div className={styles.form}>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          multiple
          hidden
          onChange={(e) => {
            addFiles(e.target.files)
            e.target.value = ''
          }}
        />

        <div
          role="button"
          tabIndex={0}
          className={mergeClasses(
            styles.dropzone,
            items.length > 0 && styles.dropzoneCompact,
            dragging && styles.dropzoneActive,
          )}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              inputRef.current?.click()
            }
          }}
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
        >
          {items.length === 0 ? (
            <>
              <ImageRegular className={styles.dropIcon} aria-hidden />
              <Body1>點此選擇圖片，或將圖片拖曳到這裡</Body1>
              <Caption1>支援 JPG、PNG、WebP、GIF，可一次選多張</Caption1>
            </>
          ) : (
            <Body1>繼續加入圖片</Body1>
          )}
        </div>

        <Field label="用途" hint={activePreset?.hint}>
          <RadioGroup
            layout="horizontal"
            className={styles.radioGroup}
            value={preset}
            onChange={(_, d) => {
              const value = d.value as PresetValue
              setPreset(value)
              const p = PRESETS.find((x) => x.value === value)
              if (p) {
                setMaxSizeMB(String(p.maxSizeMB))
                setMaxWidthOrHeight(p.maxWidthOrHeight)
                setQuality(p.initialQuality)
              }
            }}
            disabled={busy}
          >
            {PRESETS.map((p) => (
              <Radio
                key={p.value}
                value={p.value}
                label={p.label}
                className={styles.radio}
              />
            ))}
            <Radio value="custom" label="自訂" className={styles.radio} />
          </RadioGroup>
        </Field>

        <Accordion collapsible>
          <AccordionItem value="advanced">
            <AccordionHeader>進階設定</AccordionHeader>
            <AccordionPanel>
              <div className={styles.customFields}>
                <Field
                  label="目標檔案大小"
                  hint="壓縮後若仍超過這個大小，會再降低畫質。"
                >
                  <Input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={maxSizeMB}
                    onChange={(_, d) => {
                      setMaxSizeMB(d.value)
                      setPreset('custom')
                    }}
                    contentAfter={<Text size={200}>MB</Text>}
                    disabled={busy}
                  />
                </Field>

                <Field
                  label="尺寸上限"
                  hint="手機拍的照片通常遠超過螢幕需要的解析度，縮小長邊最有效。"
                >
                  <Select
                    value={String(maxWidthOrHeight)}
                    onChange={(_, d) => {
                      setMaxWidthOrHeight(Number(d.value))
                      setPreset('custom')
                    }}
                    disabled={busy}
                  >
                    {SIZE_LIMITS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label={`畫質 ${Math.round(quality * 100)}`}>
                  <Slider
                    min={30}
                    max={100}
                    step={5}
                    value={Math.round(quality * 100)}
                    onChange={(_, d) => {
                      setQuality(d.value / 100)
                      setPreset('custom')
                    }}
                    disabled={busy}
                  />
                </Field>

                <Field
                  label="輸出格式"
                  hint="不確定就維持原格式，相容性最安全。"
                >
                  <Select
                    value={format}
                    onChange={(_, d) => {
                      setFormat(d.value)
                      setPreset('custom')
                    }}
                    disabled={busy}
                  >
                    {FORMATS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </AccordionPanel>
          </AccordionItem>
        </Accordion>

        <div className={styles.actions}>
          <Button
            appearance="primary"
            icon={busy ? <Spinner size="tiny" /> : <ImageRegular />}
            onClick={run}
            disabled={pendingCount === 0 || busy}
          >
            {busy
              ? `壓縮中… 第 ${current} / ${items.length} 張`
              : `開始壓縮${pendingCount > 0 ? `（${pendingCount} 張）` : ''}`}
          </Button>
          <Button
            icon={<ArrowDownloadRegular />}
            onClick={downloadAll}
            disabled={finished.length === 0 || busy}
          >
            {finished.length > 1 ? '全部下載 (.zip)' : '下載'}
          </Button>
          <div className={styles.spacer} />
          {busy ? (
            <Button appearance="subtle" onClick={cancel}>
              取消
            </Button>
          ) : (
            items.length > 0 && (
              <Button appearance="subtle" onClick={clearAll}>
                清除全部
              </Button>
            )
          )}
        </div>

        {busy && <ProgressBar value={percent / 100} />}

        {items.length > 0 && (
          <List className={styles.list}>
            {items.map((item) => (
              <ListItem key={item.key} className={styles.row}>
                <img
                  src={item.preview}
                  alt=""
                  className={styles.thumb}
                  loading="lazy"
                />
                <div className={styles.rowMain}>
                  <Body1 className={styles.name} title={item.file.name}>
                    {item.file.name}
                  </Body1>
                  <div className={styles.sizes}>
                    <Caption1>{formatSize(item.file.size)}</Caption1>
                    {item.status === 'done' && item.output !== null && (
                      <>
                        <Caption1>→</Caption1>
                        <Caption1>{formatSize(item.output.size)}</Caption1>
                        <Caption1 className={styles.saved}>
                          −
                          {Math.round(
                            (1 - item.output.size / item.file.size) * 100,
                          )}
                          %
                        </Caption1>
                      </>
                    )}
                    {item.status === 'working' && <Caption1>壓縮中…</Caption1>}
                    {item.status === 'pending' && <Caption1>待壓縮</Caption1>}
                    {item.status === 'skipped' && (
                      <Caption1>{item.message}</Caption1>
                    )}
                    {item.status === 'error' && (
                      <Caption1 className={styles.failed}>
                        {item.message}
                      </Caption1>
                    )}
                  </div>
                </div>
                {item.output !== null && (
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={<ArrowDownloadRegular />}
                    aria-label={`下載 ${item.file.name}`}
                    onClick={() => downloadOne(item)}
                  />
                )}
                <Button
                  appearance="subtle"
                  size="small"
                  icon={<DismissRegular />}
                  aria-label={`移除 ${item.file.name}`}
                  onClick={() => removeItem(item.key)}
                  disabled={busy}
                />
              </ListItem>
            ))}
          </List>
        )}

        {finished.length > 0 && (
          <div className={styles.summary}>
            <Body1>
              共 {finished.length} 張，{formatSize(totalIn)} →{' '}
              {formatSize(totalOut)}
            </Body1>
            {totalSaved > 0 && (
              <Body1 className={styles.saved}>少了 {totalSaved}%</Body1>
            )}
          </div>
        )}
      </div>

      <Caption1 as="p" className={styles.privacy} block>
        圖片只在你的瀏覽器裡處理，不會上傳到任何伺服器。
      </Caption1>
    </>
  )
}
