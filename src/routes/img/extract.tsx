import { PageIntro } from '#/components/page-intro'
import { FilePicker } from '#/components/document-extract/file-picker'
import { ImageGallery } from '#/components/document-extract/image-gallery'
import type { GalleryImage } from '#/components/document-extract/image-gallery'
import { extractDocumentImages } from '#/libs/document-extract/extract'
import type { ExtractedImage } from '#/libs/document-extract/extract'
import { downloadBlob, packImages } from '#/libs/document-extract/download'
import { seo } from '#/libs/seo'
import {
  Button,
  MessageBar,
  MessageBarBody,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'

export const Route = createFileRoute('/img/extract')({
  head: () => ({
    meta: [
      ...seo({
        title: '文件圖片擷取',
        description:
          '讀取 DOCX、ODT 文件內的圖片並預覽，文件只在瀏覽器中處理。',
      }),
    ],
  }),
  component: RouteComponent,
})

const useStyles = makeStyles({
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
  },
  actions: { display: 'flex' },
})

function RouteComponent() {
  const styles = useStyles()
  const [file, setFile] = useState<File | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [images, setImages] = useState<(GalleryImage & ExtractedImage)[]>([])
  const [packing, setPacking] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready'>('idle')
  const [error, setError] = useState('')
  const activeRequest = useRef<AbortController | null>(null)

  useEffect(
    () => () => {
      activeRequest.current?.abort()
    },
    [],
  )
  useEffect(
    () => () => {
      images.forEach((image) => URL.revokeObjectURL(image.previewUrl))
    },
    [images],
  )

  const extract = async () => {
    if (!file || activeRequest.current) return
    const controller = new AbortController()
    activeRequest.current = controller
    setError('')
    setImages([])
    setSelectedIds(new Set())
    setStatus('loading')
    try {
      const result = await extractDocumentImages(file, controller.signal)
      if (controller.signal.aborted) return
      setImages(
        result.map((image) => ({
          blob: image.blob,
          id: image.id,
          name: image.name,
          size: image.blob.size,
          previewUrl: URL.createObjectURL(image.blob),
        })),
      )
      setSelectedIds(new Set(result.map((image) => image.id)))
      setStatus('ready')
    } catch {
      if (controller.signal.aborted) return
      setError('無法讀取文件，請確認檔案未損毀，且不是加密或受密碼保護的文件。')
      setStatus('idle')
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null
    }
  }

  const downloadSelected = async (selected: GalleryImage[]) => {
    if (activeRequest.current || !selected.length) return
    const controller = new AbortController()
    activeRequest.current = controller
    setPacking(true)
    setError('')
    try {
      const ids = new Set(selected.map((image) => image.id))
      const blob = await packImages(
        images.filter((image) => ids.has(image.id)),
        controller.signal,
      )
      if (!controller.signal.aborted)
        downloadBlob(
          blob,
          `${file?.name.replace(/\.[^.]+$/, '') || '文件'}-圖片.zip`,
        )
    } catch {
      if (!controller.signal.aborted)
        setError('圖片打包失敗，請減少選取的圖片後再試。')
    } finally {
      if (!controller.signal.aborted) setPacking(false)
      if (activeRequest.current === controller) activeRequest.current = null
    }
  }
  return (
    <>
      <PageIntro
        title="文件圖片擷取"
        description="從文件中取出圖片，省去逐張另存的操作。"
      />

      <div className={styles.content}>
        <MessageBar intent="info">
          <MessageBarBody>
            讀取 DOCX、ODT
            內的圖片資源，包含照片、插圖或標誌，順序可能與文件不同。圖片以原始格式下載，文件只在瀏覽器中處理。
          </MessageBarBody>
        </MessageBar>
        <FilePicker
          file={file}
          disabled={status === 'loading' || packing}
          onFileChange={(nextFile) => {
            setFile(nextFile)
            setSelectedIds(new Set())
            setImages([])
            setStatus('idle')
            setError('')
          }}
        />
        <div className={styles.actions}>
          <Button
            appearance="primary"
            disabled={!file || status === 'loading' || packing}
            onClick={() => void extract()}
          >
            {status === 'loading' ? '正在擷取…' : '擷取圖片'}
          </Button>
        </div>
        {error && (
          <MessageBar intent="error">
            <MessageBarBody>{error}</MessageBarBody>
          </MessageBar>
        )}
        <ImageGallery
          images={images}
          selectedIds={selectedIds}
          status={status}
          onSelectionChange={setSelectedIds}
          packing={packing}
          onDownload={(image) => {
            const source = images.find((item) => item.id === image.id)
            if (source) {
              setError('')
              try {
                downloadBlob(source.blob, source.name)
              } catch {
                setError('圖片下載失敗，請再試一次。')
              }
            }
          }}
          onDownloadSelected={(selected) => void downloadSelected(selected)}
        />
      </div>
    </>
  )
}
