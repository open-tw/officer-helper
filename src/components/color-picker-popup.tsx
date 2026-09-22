import {
  Button,
  ColorArea,
  ColorPicker,
  ColorSlider,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import type { ColorPickerProps } from '@fluentui/react-components'
import { useEffect, useState } from 'react'

type HSV = { h: number; s: number; v: number; a: number }

/* ------------------------------------------------------------------ */
/* 色彩轉換（只處理 #rrggbb，不額外裝 tinycolor）                        */
/* ------------------------------------------------------------------ */

function hexToHsv(hex: string): HSV {
  const m = /^#?([\da-f]{6})$/i.exec(hex.trim())
  const int = m ? parseInt(m[1], 16) : 0
  const r = ((int >> 16) & 255) / 255
  const g = ((int >> 8) & 255) / 255
  const b = (int & 255) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min

  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }

  return { h, s: max === 0 ? 0 : d / max, v: max, a: 1 }
}

function hsvToHex({ h, s, v }: HSV): string {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  const i = Math.floor(h / 60) % 6
  const [r, g, b] = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ][i]

  const hex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, '0')

  return `#${hex(r)}${hex(g)}${hex(b)}`
}

/* ------------------------------------------------------------------ */
/* 樣式                                                                */
/* ------------------------------------------------------------------ */

const useStyles = makeStyles({
  surface: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalM,
  },
  row: {
    display: 'flex',
    columnGap: tokens.spacingHorizontalM,
  },
  sliders: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
  },
  swatch: {
    width: '48px',
    height: '48px',
    alignSelf: 'center',
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
    '@media (forced-colors: active)': {
      forcedColorAdjust: 'none',
    },
  },
  trigger: {
    minWidth: 'auto',
    paddingInline: tokens.spacingHorizontalS,
    columnGap: tokens.spacingHorizontalS,
  },
  triggerSwatch: {
    width: '20px',
    height: '20px',
    borderRadius: tokens.borderRadiusSmall,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
    '@media (forced-colors: active)': {
      forcedColorAdjust: 'none',
    },
  },
  value: {
    fontFamily: tokens.fontFamilyMonospace,
  },
})

/* ------------------------------------------------------------------ */
/* 元件                                                                */
/* ------------------------------------------------------------------ */

export type ColorPickerPopupProps = {
  /** #rrggbb 格式 */
  value: string
  onChange: (hex: string) => void
  /** 給輔助技術用的名稱，例如「前景顏色」 */
  label: string
  id?: string
}

export function ColorPickerPopup({
  value,
  onChange,
  label,
  id,
}: ColorPickerPopupProps) {
  const styles = useStyles()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<HSV>(() => hexToHsv(value))

  // 每次打開時，從外部目前的顏色重新開始
  useEffect(() => {
    if (open) setDraft(hexToHsv(value))
  }, [open, value])

  const handleChange: ColorPickerProps['onColorChange'] = (_, data) =>
    setDraft({ ...data.color, a: data.color.a ?? 1 })

  return (
    <Popover open={open} trapFocus onOpenChange={(_, d) => setOpen(d.open)}>
      <PopoverTrigger disableButtonEnhancement>
        <Button
          id={id}
          className={styles.trigger}
          aria-label={`${label}：${value}`}
        >
          <span
            className={styles.triggerSwatch}
            style={{ backgroundColor: value }}
          />
          <span className={styles.value}>{value}</span>
        </Button>
      </PopoverTrigger>

      <PopoverSurface>
        <div className={styles.surface}>
          <ColorPicker color={draft} onColorChange={handleChange}>
            <ColorArea
              inputX={{ 'aria-label': '飽和度' }}
              inputY={{ 'aria-label': '亮度' }}
            />
            <div className={styles.row}>
              <div className={styles.sliders}>
                <ColorSlider aria-label="色相" />
              </div>
              <div
                className={styles.swatch}
                style={{ backgroundColor: hsvToHex(draft) }}
              />
            </div>
          </ColorPicker>

          <div className={styles.row}>
            <Button
              appearance="primary"
              onClick={() => {
                onChange(hsvToHex(draft))
                setOpen(false)
              }}
            >
              確定
            </Button>
            <Button onClick={() => setOpen(false)}>取消</Button>
          </div>
        </div>
      </PopoverSurface>
    </Popover>
  )
}
