import { ColorPickerPopup } from '#/components/color-picker-popup'
import { PageIntro } from '#/components/page-intro'
import { seo } from '#/libs/seo'
import {
  Button,
  Caption1,
  Card,
  Field,
  Label,
  Radio,
  RadioGroup,
  Select,
  Textarea,
  Toast,
  ToastTitle,
  Toaster,
  makeStyles,
  tokens,
  useId,
  useToastController,
} from '@fluentui/react-components'
import {
  ArrowDownloadRegular,
  CopyRegular,
  QrCodeRegular,
} from '@fluentui/react-icons'
import { createFileRoute } from '@tanstack/react-router'
import { useDeferredValue, useRef, useState } from 'react'
import QRCode from 'react-qr-code'

export const Route = createFileRoute('/qr-code')({
  head: () => ({
    meta: [
      ...seo({
        title: 'QR Code 產生器',
        description:
          '輸入網址或文字產生 QR Code，可下載 PNG、SVG 或直接複製貼上。',
      }),
    ],
  }),
  component: RouteComponent,
})

/* ------------------------------------------------------------------ */
/* 設定值                                                              */
/* ------------------------------------------------------------------ */

type Level = 'L' | 'M' | 'Q' | 'H'

// 容量為 QR Code 第 40 版在 byte 模式下的上限（UTF-8 位元組）
const LEVELS: { value: Level; label: string; capacity: number }[] = [
  { value: 'L', label: '低（7%）', capacity: 2953 },
  { value: 'M', label: '中（15%）', capacity: 2331 },
  { value: 'Q', label: '較高（25%）', capacity: 1663 },
  { value: 'H', label: '高（30%）', capacity: 1273 },
]

const SIZES = [
  { value: 256, label: '小 256 px（螢幕、簡報）' },
  { value: 512, label: '中 512 px（文件內嵌）' },
  { value: 1024, label: '大 1024 px（列印）' },
  { value: 2048, label: '特大 2048 px（海報、大圖輸出）' },
] as const

type Size = (typeof SIZES)[number]['value']

/** QR Code 規範要求四周至少留 4 格空白（quiet zone），掃描器才讀得到 */
const QUIET_ZONE = 4

/* ------------------------------------------------------------------ */
/* 工具函式                                                            */
/* ------------------------------------------------------------------ */

function byteLength(text: string) {
  return new TextEncoder().encode(text).length
}

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** 從內容推一個看得懂的檔名：網址用網域，其他用 qrcode */
function fileBaseName(text: string) {
  try {
    const host = new URL(text.trim()).hostname.replace(/^www\./, '')
    if (host) return `qrcode-${host}`
  } catch {
    // 不是網址
  }
  return 'qrcode'
}

/** 把畫面上的 QR Code 包成含 quiet zone 的獨立 SVG 字串 */
function buildSvg(svg: SVGSVGElement, bgColor: string, size: number) {
  const modules = svg.viewBox.baseVal.width
  const total = modules + QUIET_ZONE * 2
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"`,
    ` viewBox="${-QUIET_ZONE} ${-QUIET_ZONE} ${total} ${total}" shape-rendering="crispEdges">`,
    `<rect x="${-QUIET_ZONE}" y="${-QUIET_ZONE}" width="${total}" height="${total}" fill="${bgColor}"/>`,
    svg.innerHTML,
    `</svg>`,
  ].join('')
}

function svgToPngBlob(svgText: string, size: number) {
  return new Promise<Blob>((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(
      new Blob([svgText], { type: 'image/svg+xml' }),
    )
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('瀏覽器不支援 canvas'))
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(img, 0, 0, size, size)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('無法產生圖片'))),
        'image/png',
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('無法產生圖片'))
    }
    img.src = url
  })
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/* ------------------------------------------------------------------ */
/* 樣式                                                                */
/* ------------------------------------------------------------------ */

const useStyles = makeStyles({
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 340px',
    gap: tokens.spacingHorizontalXXL,
    alignItems: 'start',
    '@media (max-width: 760px)': {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalL,
  },
  radioGroup: {
    flexWrap: 'wrap',
  },
  radio: {
    whiteSpace: 'nowrap',
  },
  colors: {
    display: 'flex',
    flexWrap: 'wrap',
    columnGap: tokens.spacingHorizontalXXL,
    rowGap: tokens.spacingVerticalM,
  },
  colorField: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalS,
  },
  previewCard: {
    position: 'sticky',
    top: tokens.spacingVerticalL,
    rowGap: tokens.spacingVerticalM,
  },
  previewBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    aspectRatio: '1',
    padding: tokens.spacingHorizontalXL,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
  },
  qr: {
    width: '100%',
    height: 'auto',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    rowGap: tokens.spacingVerticalS,
    color: tokens.colorNeutralForeground4,
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: '48px',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalS,
  },
  secondaryActions: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: tokens.spacingHorizontalS,
  },
  meta: {
    color: tokens.colorNeutralForeground3,
    textAlign: 'center',
  },
})

/* ------------------------------------------------------------------ */
/* 元件                                                                */
/* ------------------------------------------------------------------ */

function RouteComponent() {
  const styles = useStyles()
  const toasterId = useId('qr-toaster')
  const fgId = useId('fg')
  const bgId = useId('bg')
  const { dispatchToast } = useToastController(toasterId)
  const previewRef = useRef<HTMLDivElement>(null)

  const [value, setValue] = useState('')
  const [level, setLevel] = useState<Level>('M')
  const [size, setSize] = useState<Size>(1024)
  const [fgColor, setFgColor] = useState('#000000')
  const [bgColor, setBgColor] = useState('#ffffff')

  // 打字時先更新輸入框，QR Code 稍後跟上，長文字也不會卡
  const deferredValue = useDeferredValue(value)

  const trimmed = deferredValue.trim()
  const bytes = byteLength(trimmed)
  const capacity = LEVELS.find((l) => l.value === level)!.capacity
  const tooLong = bytes > capacity
  const canRender = trimmed.length > 0 && !tooLong

  const contrast = contrastRatio(fgColor, bgColor)
  const inverted = luminance(fgColor) > luminance(bgColor)
  const colorWarning =
    contrast < 4
      ? '前景與背景顏色太接近，可能無法掃描。'
      : inverted
        ? '前景比背景淺（反白），部分掃描器無法讀取。'
        : null

  const notify = (title: string, intent: 'success' | 'error') =>
    dispatchToast(
      <Toast>
        <ToastTitle>{title}</ToastTitle>
      </Toast>,
      { intent, timeout: 3000 },
    )

  const getSvg = () => {
    const svg = previewRef.current?.querySelector('svg')
    if (!svg) throw new Error('請先輸入內容')
    return buildSvg(svg, bgColor, size)
  }

  const downloadPng = async () => {
    try {
      const blob = await svgToPngBlob(getSvg(), size)
      downloadBlob(blob, `${fileBaseName(trimmed)}.png`)
    } catch (e) {
      notify(e instanceof Error ? e.message : '下載失敗', 'error')
    }
  }

  const downloadSvg = () => {
    try {
      const blob = new Blob([getSvg()], { type: 'image/svg+xml' })
      downloadBlob(blob, `${fileBaseName(trimmed)}.svg`)
    } catch (e) {
      notify(e instanceof Error ? e.message : '下載失敗', 'error')
    }
  }

  const copyImage = async () => {
    try {
      if (typeof ClipboardItem === 'undefined') {
        throw new Error('這個瀏覽器不支援複製圖片，請改用下載')
      }
      // 直接傳 Promise 給 ClipboardItem，Safari 才不會判定為非使用者操作
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': svgToPngBlob(getSvg(), size) }),
      ])
      notify('已複製，可直接貼到 Word、簡報或通訊軟體', 'success')
    } catch (e) {
      notify(e instanceof Error ? e.message : '複製失敗', 'error')
    }
  }

  return (
    <>
      <Toaster toasterId={toasterId} position="top-end" />

      <PageIntro
        title="QR Code 產生器"
        description="輸入網址或文字，右側會即時產生 QR Code。"
      />

      <div className={styles.layout}>
        <div className={styles.form}>
          <Field
            label="內容"
            required
            validationState={tooLong ? 'error' : 'none'}
            validationMessage={
              tooLong
                ? `內容太長：目前 ${bytes} bytes，此容錯率上限 ${capacity} bytes。請縮短內容或降低容錯率。`
                : undefined
            }
            hint={
              tooLong
                ? undefined
                : `網址、文字、電話都可以。中文字每字約佔 3 bytes（${bytes} / ${capacity}）`
            }
          >
            <Textarea
              value={value}
              onChange={(_, d) => setValue(d.value)}
              placeholder="例如：https://www.example.gov.tw/"
              resize="vertical"
              rows={3}
            />
          </Field>

          <Field
            label="容錯率"
            hint="容錯率越高，圖案越密，但污損或中間蓋上 logo 時仍可讀取。一般用途選「中」即可。"
          >
            <RadioGroup
              layout="horizontal"
              className={styles.radioGroup}
              value={level}
              onChange={(_, d) => setLevel(d.value as Level)}
            >
              {LEVELS.map((l) => (
                <Radio
                  key={l.value}
                  value={l.value}
                  label={l.label}
                  className={styles.radio}
                />
              ))}
            </RadioGroup>
          </Field>

          <Field
            label="下載尺寸"
            hint="只影響 PNG 與複製的解析度，SVG 可無限放大。"
          >
            <Select
              value={String(size)}
              onChange={(_, d) => setSize(Number(d.value) as Size)}
            >
              {SIZES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="顏色"
            validationState={colorWarning ? 'warning' : 'none'}
            validationMessage={colorWarning ?? undefined}
          >
            <div className={styles.colors}>
              <div className={styles.colorField}>
                <Label htmlFor={fgId}>前景</Label>
                <ColorPickerPopup
                  id={fgId}
                  label="前景顏色"
                  value={fgColor}
                  onChange={setFgColor}
                />
              </div>
              <div className={styles.colorField}>
                <Label htmlFor={bgId}>背景</Label>
                <ColorPickerPopup
                  id={bgId}
                  label="背景顏色"
                  value={bgColor}
                  onChange={setBgColor}
                />
              </div>
            </div>
          </Field>
        </div>

        <Card className={styles.previewCard}>
          <div
            ref={previewRef}
            className={styles.previewBox}
            style={{ backgroundColor: canRender ? bgColor : undefined }}
          >
            {canRender ? (
              <QRCode
                value={trimmed}
                level={level}
                fgColor={fgColor}
                bgColor={bgColor}
                size={256}
                className={styles.qr}
                title={`QR Code：${trimmed}`}
              />
            ) : (
              <div className={styles.empty}>
                <QrCodeRegular className={styles.emptyIcon} aria-hidden />
                <Caption1>
                  {tooLong ? '內容太長，無法產生' : '輸入內容後會在這裡顯示'}
                </Caption1>
              </div>
            )}
          </div>

          <div className={styles.actions}>
            <Button
              appearance="primary"
              icon={<ArrowDownloadRegular />}
              onClick={downloadPng}
              disabled={!canRender}
            >
              下載 PNG
            </Button>
            <div className={styles.secondaryActions}>
              <Button
                icon={<CopyRegular />}
                onClick={copyImage}
                disabled={!canRender}
              >
                複製圖片
              </Button>
              <Button
                icon={<ArrowDownloadRegular />}
                onClick={downloadSvg}
                disabled={!canRender}
              >
                下載 SVG
              </Button>
            </div>
          </div>

          {canRender && (
            <Caption1 className={styles.meta}>
              {size} × {size} px・已含四周留白
            </Caption1>
          )}
        </Card>
      </div>
    </>
  )
}
