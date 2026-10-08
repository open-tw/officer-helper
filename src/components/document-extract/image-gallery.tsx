import {
  Body1,
  Button,
  Caption1,
  Checkbox,
  Spinner,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import { useState } from 'react'

function ImagePreview({
  image,
  className,
}: {
  image: GalleryImage
  className: string
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  return failedUrl === image.previewUrl ? (
    <Body1>瀏覽器無法預覽此圖片格式。</Body1>
  ) : (
    <img
      className={className}
      src={image.previewUrl}
      alt={image.name}
      loading="lazy"
      onError={() => setFailedUrl(image.previewUrl)}
    />
  )
}

/** Preview URLs are supplied and released by the caller. */
export type GalleryImage = {
  id: string
  name: string
  previewUrl: string
  size: number
}

export type ImageGalleryProps = {
  images: GalleryImage[]
  selectedIds: ReadonlySet<string>
  status: 'idle' | 'loading' | 'ready'
  packing?: boolean
  onSelectionChange: (ids: Set<string>) => void
  onDownload?: (image: GalleryImage) => void
  onDownloadSelected?: (images: GalleryImage[]) => void
}

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
  },
  toolbar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))',
    gap: tokens.spacingHorizontalM,
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalM,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    minWidth: 0,
    overflowWrap: 'anywhere',
  },
  preview: {
    width: '100%',
    height: '160px',
    objectFit: 'contain',
    backgroundColor: tokens.colorNeutralBackground3,
  },
})

export function ImageGallery({
  images,
  selectedIds,
  status,
  packing = false,
  onSelectionChange,
  onDownload,
  onDownloadSelected,
}: ImageGalleryProps) {
  const styles = useStyles()
  const selected = images.filter((image) => selectedIds.has(image.id))

  return (
    <section
      className={styles.root}
      aria-label="擷取圖片"
      aria-busy={status === 'loading' || packing}
    >
      {status === 'loading' ? (
        <Spinner label="正在擷取圖片…" />
      ) : status === 'idle' ? (
        <Body1 role="status">擷取後的圖片會顯示在這裡。</Body1>
      ) : images.length === 0 ? (
        <Body1 role="status">這份文件沒有可擷取的圖片。</Body1>
      ) : (
        <>
          <div className={styles.toolbar}>
            <Checkbox
              label="全選"
              disabled={packing}
              checked={
                selected.length === images.length
                  ? true
                  : selected.length > 0
                    ? 'mixed'
                    : false
              }
              onChange={(_, data) =>
                onSelectionChange(
                  new Set(
                    data.checked === true
                      ? images.map((image) => image.id)
                      : [],
                  ),
                )
              }
            />
            <Body1>
              已選 {selected.length} / {images.length} 張
            </Body1>
            <Button
              appearance="primary"
              disabled={packing || !selected.length || !onDownloadSelected}
              onClick={() => onDownloadSelected?.(selected)}
            >
              {packing ? '正在打包…' : '打包下載'}
            </Button>
          </div>
          <div className={styles.grid}>
            {images.map((image) => (
              <article key={image.id} className={styles.card}>
                <ImagePreview className={styles.preview} image={image} />
                <Checkbox
                  disabled={packing}
                  label={image.name}
                  checked={selectedIds.has(image.id)}
                  onChange={(_, data) => {
                    const next = new Set(selectedIds)
                    if (data.checked === true) next.add(image.id)
                    else next.delete(image.id)
                    onSelectionChange(next)
                  }}
                />
                <Caption1>
                  {image.size < 1024 * 1024
                    ? `${Math.ceil(image.size / 1024)} KB`
                    : `${(image.size / (1024 * 1024)).toFixed(1)} MB`}
                </Caption1>
                <Button
                  disabled={packing || !onDownload}
                  onClick={() => onDownload?.(image)}
                  aria-label={`下載 ${image.name}`}
                >
                  下載圖片
                </Button>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
