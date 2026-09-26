import { PageIntro } from '#/components/page-intro'
import { seo } from '#/libs/seo'
import {
  Body1,
  Button,
  Caption1,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Select,
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
import { useEffect, useRef, useState } from 'react'

export const Route = createFileRoute('/img/watermark')({
  head: () => ({
    meta: [
      ...seo({
        title: '圖片浮水印',
        description:
          '在圖片上加入文字浮水印，標示來源或用途，圖片不會上傳到伺服器。',
      }),
    ],
  }),
  component: RouteComponent,
})

/* ------------------------------------------------------------------ */
/* 設定值                                                              */
/* ------------------------------------------------------------------ */

const ACCEPTED = 'image/jpeg,image/png,image/webp,image/bmp'

const WATERMARK = {
  /** 字級佔圖片短邊的比例 */
  fontRatio: 1 / 18,
  /** 橫向間距（字級的倍數） */
  gapX: 3,
  /** 行距（字級的倍數） */
  gapY: 4,
}

/* ------------------------------------------------------------------ */
/* 工具函式                                                            */
/* ------------------------------------------------------------------ */

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** iPhone 的 HEIC 瀏覽器解不開，要給明確指示 */
function isHeic(file: File) {
  return /\.hei[cf]$/i.test(file.name) || /hei[cf]/i.test(file.type)
}

/** 把原圖畫到 canvas，再斜向鋪滿整張的浮水印文字 */
function drawWatermark(
  canvas: HTMLCanvasElement,
  image: ImageBitmap,
  text: string,
  size: number,
  transparency: number,
  angle: number,
) {
  const { width, height } = image
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.drawImage(image, 0, 0)

  const label = text.trim()
  if (!label) return

  const fontSize = Math.max(
    12,
    Math.round(Math.min(width, height) * WATERMARK.fontRatio * size),
  )
  ctx.save()
  ctx.font = `bold ${fontSize}px system-ui, "Noto Sans TC", "Microsoft JhengHei", sans-serif`
  ctx.fillStyle = `rgba(128, 128, 128, ${1 - transparency / 100})`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // 以圖片中心旋轉，鋪滿範圍取對角線長度，轉完四個角才不會缺字
  ctx.translate(width / 2, height / 2)
  ctx.rotate((angle * Math.PI) / 180)
  const half = Math.hypot(width, height) / 2
  const stepX = ctx.measureText(label).width + fontSize * WATERMARK.gapX
  const stepY = fontSize * WATERMARK.gapY

  for (let row = 0, y = -half; y <= half; row++, y += stepY) {
    // 奇數行錯開半格，看起來比較像交錯排列、也比較難被裁掉
    const offset = row % 2 === 0 ? 0 : stepX / 2
    for (let x = -half - offset; x <= half + stepX; x += stepX) {
      ctx.fillText(label, x, y)
    }
  }
  ctx.restore()
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
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  spacer: {
    flex: 1,
  },
  preview: {
    display: 'flex',
    justifyContent: 'center',
    padding: tokens.spacingVerticalM,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  canvas: {
    display: 'block',
    maxWidth: '100%',
    maxHeight: '70vh',
    height: 'auto',
    boxShadow: tokens.shadow4,
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
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [image, setImage] = useState<ImageBitmap | null>(null)
  const [text, setText] = useState('')
  const [size, setSize] = useState(1)
  const [transparency, setTransparency] = useState(55)
  const [angle, setAngle] = useState(-30)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)

  // 換圖或離開頁面時釋放解碼後的點陣圖
  useEffect(() => () => image?.close(), [image])

  useEffect(() => {
    if (canvasRef.current && image)
      drawWatermark(canvasRef.current, image, text, size, transparency, angle)
  }, [image, text, size, transparency, angle])

  const pickFile = async (list: FileList | null) => {
    const picked = list?.[0]
    if (!picked) return
    setError('')
    if (isHeic(picked)) {
      setError('瀏覽器無法讀取 HEIC，請先在手機上轉成 JPG')
      return
    }
    if (!picked.type.startsWith('image/')) {
      setError('請選擇圖片檔案')
      return
    }
    try {
      // 照手機 EXIF 的方向轉正，不然直拍的照片會躺著
      const bitmap = await createImageBitmap(picked, {
        imageOrientation: 'from-image',
      })
      setFile(picked)
      setImage(bitmap)
    } catch {
      setError('無法讀取這張圖片，請換一張試試')
    }
  }

  const clear = () => {
    setFile(null)
    setImage(null)
    setError('')
    if (inputRef.current) inputRef.current.value = ''
  }

  const download = () => {
    const canvas = canvasRef.current
    if (!canvas || !file) return
    // JPEG 維持 JPEG，其他格式一律輸出 PNG 避免失真
    const type = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png'
    const ext = type === 'image/jpeg' ? 'jpg' : 'png'
    const base = file.name.replace(/\.[^.]+$/, '')
    canvas.toBlob(
      (blob) => {
        if (blob) downloadBlob(blob, `${base}-浮水印.${ext}`)
      },
      type,
      0.92,
    )
  }

  return (
    <>
      <PageIntro
        title="圖片浮水印"
        description="在圖片上加入文字浮水印，標示來源或用途，避免被任意轉用。"
      />

      <div className={styles.form}>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          hidden
          onChange={(e) => {
            void pickFile(e.target.files)
            e.target.value = ''
          }}
        />

        <div
          role="button"
          tabIndex={0}
          className={mergeClasses(
            styles.dropzone,
            image !== null && styles.dropzoneCompact,
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
            void pickFile(e.dataTransfer.files)
          }}
        >
          {image ? (
            <Body1>換一張圖片</Body1>
          ) : (
            <>
              <ImageRegular className={styles.dropIcon} aria-hidden />
              <Body1>點此選擇圖片，或將圖片拖曳到這裡</Body1>
              <Caption1>支援 JPG、PNG、WebP</Caption1>
            </>
          )}
        </div>

        {error && (
          <MessageBar intent="error">
            <MessageBarBody>{error}</MessageBarBody>
          </MessageBar>
        )}

        <Field
          label="浮水印文字"
          hint="例如網站名稱、作者署名，或「僅供 OO 申請使用」等用途說明。"
        >
          <Input
            value={text}
            onChange={(_, d) => setText(d.value)}
            placeholder="輸入要加在圖片上的文字"
          />
        </Field>

        <Field label="浮水印大小" hint="依圖片尺寸等比例調整文字大小。">
          <Select
            value={String(size)}
            onChange={(_, d) => setSize(Number(d.value))}
          >
            <option value={0.5}>小（50%）</option>
            <option value={0.75}>偏小（75%）</option>
            <option value={1}>標準（100%）</option>
            <option value={1.5}>大（150%）</option>
            <option value={2}>特大（200%）</option>
          </Select>
        </Field>

        <Field label="浮水印透明度" hint="數值越高，文字越透明。">
          <Select
            value={String(transparency)}
            onChange={(_, d) => setTransparency(Number(d.value))}
          >
            <option value={0}>0%（不透明）</option>
            <option value={25}>25%</option>
            <option value={55}>55%（預設）</option>
            <option value={75}>75%</option>
            <option value={90}>90%</option>
          </Select>
        </Field>

        <Field label="文字角度">
          <Select
            value={String(angle)}
            onChange={(_, d) => setAngle(Number(d.value))}
          >
            <option value={-60}>−60°（向右上傾斜）</option>
            <option value={-45}>−45°（向右上傾斜）</option>
            <option value={-30}>−30°（向右上傾斜，預設）</option>
            <option value={0}>0°（水平）</option>
            <option value={30}>30°（向右下傾斜）</option>
            <option value={45}>45°（向右下傾斜）</option>
            <option value={60}>60°（向右下傾斜）</option>
            <option value={90}>90°（垂直）</option>
          </Select>
        </Field>

        <div className={styles.actions}>
          <Button
            appearance="primary"
            icon={<ArrowDownloadRegular />}
            onClick={download}
            disabled={!image || !text.trim()}
          >
            下載
          </Button>
          <div className={styles.spacer} />
          {image && (
            <Button
              appearance="subtle"
              icon={<DismissRegular />}
              onClick={clear}
            >
              清除
            </Button>
          )}
        </div>

        {image && (
          <div className={styles.preview}>
            <canvas
              ref={canvasRef}
              className={styles.canvas}
              aria-label="浮水印預覽"
            />
          </div>
        )}
      </div>

      <Caption1 as="p" className={styles.privacy} block>
        圖片只在你的瀏覽器裡處理，不會上傳到任何伺服器。
      </Caption1>
    </>
  )
}
