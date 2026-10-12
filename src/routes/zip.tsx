import { PageIntro } from '#/components/page-intro'
import { seo } from '#/libs/seo'
import { encryptionError, encryptionOptions } from '#/libs/zip-encryption'
import type { ZipEncryption } from '#/libs/zip-encryption'
import { mergeZipFiles } from '#/libs/zip-files'
import type { ConflictChoice } from '#/libs/zip-files'
import {
  Button,
  Checkbox,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Field,
  Input,
  Select,
  Spinner,
  Text,
} from '@fluentui/react-components'
import {
  ArrowDownloadRegular,
  DeleteRegular,
  FolderZipRegular,
} from '@fluentui/react-icons'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'

export const Route = createFileRoute('/zip')({
  head: () => ({
    meta: [
      ...seo({
        title: '壓一起',
      }),
    ],
  }),
  component: RouteComponent,
})

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function RouteComponent() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [zipName, setZipName] = useState('archive')
  const [encrypted, setEncrypted] = useState(false)
  const [encryptionMethod, setEncryptionMethod] =
    useState<ZipEncryption['method']>('zipcrypto')
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const encryption = {
    enabled: encrypted,
    method: encryptionMethod,
    showPassword,
    password,
    confirmation,
  }
  const passwordError = encryptionError(encryption)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [conflict, setConflict] = useState<{
    oldFile: File
    newFile: File
    newName: string
  } | null>(null)
  const locked = useRef(false)
  const mounted = useRef(true)
  const resolveConflict = useRef<((choice: ConflictChoice) => void) | null>(
    null,
  )

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      resolveConflict.current?.('cancel')
      resolveConflict.current = null
    }
  }, [])

  const chooseConflict = (choice: ConflictChoice) => {
    const resolve = resolveConflict.current
    resolveConflict.current = null
    setConflict(null)
    resolve?.(choice)
  }

  const addFiles = async (list: FileList | File[] | null) => {
    if (!list || locked.current) return
    const incoming = Array.from(list)
    if (incoming.length === 0) return
    locked.current = true
    setAdding(true)
    setError(null)
    setNotice(null)
    try {
      const result = await mergeZipFiles(
        files,
        incoming,
        (oldFile, newFile, newName) => {
          if (!mounted.current) return Promise.resolve('cancel')
          setConflict({ oldFile, newFile, newName })
          return new Promise<ConflictChoice>((resolve) => {
            resolveConflict.current = resolve
          })
        },
      )
      if (mounted.current) {
        setFiles(result.files)
        if (result.duplicates)
          setNotice(`已略過 ${result.duplicates} 個同名且內容相同的檔案。`)
      }
    } catch (e) {
      if (mounted.current)
        setError(e instanceof Error ? e.message : '讀取檔案失敗，請再試一次。')
    } finally {
      locked.current = false
      if (mounted.current) setAdding(false)
    }
  }

  const removeFile = (idx: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== idx))

  const clear = () => {
    setFiles([])
    setNotice(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const compress = async () => {
    if (files.length === 0 || locked.current) return
    if (passwordError) {
      setError(passwordError)
      return
    }
    locked.current = true
    setBusy(true)
    setError(null)
    setProgress(0)
    try {
      const { BlobReader, BlobWriter, ZipWriter } =
        await import('@zip.js/zip.js')
      const writer = new ZipWriter(
        new BlobWriter('application/zip'),
        encryptionOptions(encryption),
      )
      const total = files.reduce((sum, f) => sum + f.size, 0) || 1
      let done = 0
      for (const f of files) {
        let last = 0
        await writer.add(f.name, new BlobReader(f), {
          lastModDate: new Date(f.lastModified),
          onprogress: (p) => {
            done += p - last
            last = p
            setProgress(Math.min(100, Math.round((done / total) * 100)))
          },
        })
      }
      const blob = await writer.close()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${zipName.trim() || 'archive'}.zip`
      a.click()
      URL.revokeObjectURL(url)
      setProgress(100)
    } catch (e) {
      setError(e instanceof Error ? e.message : '壓縮失敗，請再試一次。')
    } finally {
      locked.current = false
      setBusy(false)
    }
  }

  const totalSize = files.reduce((sum, f) => sum + f.size, 0)

  return (
    <div style={{ maxWidth: 640, padding: '1rem' }}>
      <PageIntro
        title="壓一起"
        description="選擇多個檔案，在瀏覽器內打包成一個 .zip 檔案下載。"
      />

      <input
        ref={inputRef}
        type="file"
        multiple
        disabled={busy || adding}
        style={{ display: 'none' }}
        onChange={(e) => {
          void addFiles(e.target.files)
          e.target.value = ''
        }}
      />

      <div
        onClick={() => {
          if (!locked.current) inputRef.current?.click()
        }}
        onDragOver={(e) => {
          e.preventDefault()
          if (!locked.current) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          void addFiles(e.dataTransfer.files)
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
        <FolderZipRegular fontSize={32} />
        <div style={{ marginTop: '0.5rem' }}>
          <Text>點此選擇檔案，或將檔案拖曳至此（可多選）</Text>
        </div>
      </div>

      {files.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: '1rem 0 0',
            border: '1px solid #e0e0e0',
            borderRadius: 8,
          }}
        >
          {files.map((f, i) => (
            <li
              key={f.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 0.75rem',
                borderTop: i === 0 ? 'none' : '1px solid #e0e0e0',
              }}
            >
              <Text
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {f.name}
              </Text>
              <Text size={200}>{formatSize(f.size)}</Text>
              <Button
                appearance="subtle"
                size="small"
                icon={<DeleteRegular />}
                aria-label="移除"
                onClick={() => removeFile(i)}
                disabled={busy || adding}
              />
            </li>
          ))}
          <li
            style={{
              padding: '0.5rem 0.75rem',
              borderTop: '1px solid #e0e0e0',
              textAlign: 'right',
            }}
          >
            <Text size={200}>
              共 {files.length} 個檔案，{formatSize(totalSize)}
            </Text>
          </li>
        </ul>
      )}

      <Field label="壓縮檔名稱" style={{ marginTop: '1rem' }}>
        <Input
          value={zipName}
          onChange={(_, d) => setZipName(d.value)}
          contentAfter={<Text size={200}>.zip</Text>}
          disabled={busy || adding}
        />
      </Field>

      <div style={{ marginTop: '1rem' }}>
        <Checkbox
          label="加密"
          checked={encrypted}
          disabled={busy || adding}
          onChange={(_, data) => {
            setEncrypted(data.checked === true)
            setPassword('')
            setConfirmation('')
            setShowPassword(false)
          }}
        />
        {encrypted && (
          <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.5rem' }}>
            <Field label="加密方法">
              <Select
                value={encryptionMethod}
                disabled={busy || adding}
                onChange={(_, data) =>
                  setEncryptionMethod(
                    data.value === 'aes256' ? 'aes256' : 'zipcrypto',
                  )
                }
              >
                <option value="zipcrypto">相容模式（ZipCrypto）</option>
                <option value="aes256">AES-256</option>
              </Select>
            </Field>
            <Field label="密碼" required>
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                autoComplete="new-password"
                disabled={busy || adding}
                onChange={(_, data) => setPassword(data.value)}
              />
            </Field>
            <Checkbox
              label="顯示密碼"
              checked={showPassword}
              disabled={busy || adding}
              onChange={(_, data) => {
                setShowPassword(data.checked === true)
                setConfirmation('')
              }}
            />
            {!showPassword && (
              <Field
                label="再次輸入密碼"
                required
                validationState={
                  confirmation && confirmation !== password ? 'error' : 'none'
                }
                validationMessage={
                  confirmation && confirmation !== password
                    ? '兩次輸入的密碼不一致。'
                    : undefined
                }
              >
                <Input
                  type="password"
                  value={confirmation}
                  autoComplete="new-password"
                  disabled={busy || adding}
                  onChange={(_, data) => setConfirmation(data.value)}
                />
              </Field>
            )}
            <Text size={200}>
              {showPassword
                ? '請確認密碼正確後再壓縮。'
                : '請輸入相同密碼兩次後再壓縮。'}
              {encryptionMethod === 'zipcrypto'
                ? '相容模式安全性較低，不建議用於敏感資料；能否解壓仍依工具與版本而定。'
                : 'AES-256 安全性較高，解壓縮工具需支援此格式。'}
              ZIP 內的檔名仍可見。
            </Text>
          </div>
        )}
      </div>

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
          onClick={compress}
          disabled={
            files.length === 0 || busy || adding || passwordError !== null
          }
        >
          {busy ? `壓縮中 ${progress}%` : '壓縮並下載'}
        </Button>
        {files.length > 0 && (
          <Button appearance="subtle" onClick={clear} disabled={busy || adding}>
            清除
          </Button>
        )}
      </div>

      {adding && (
        <Spinner
          size="tiny"
          label="正在檢查檔案，請先完成同名檔案的選擇。"
          style={{ marginTop: '0.75rem' }}
        />
      )}
      {notice && (
        <Text role="status" style={{ display: 'block', marginTop: '0.75rem' }}>
          {notice}
        </Text>
      )}

      <Dialog
        open={conflict !== null}
        onOpenChange={(_, data) => {
          if (!data.open) chooseConflict('cancel')
        }}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>同名檔案內容不同</DialogTitle>
            <DialogContent>
              <p style={{ overflowWrap: 'anywhere' }}>
                「{conflict?.newFile.name}」已存在，請選擇如何處理新檔案。
              </p>
              <p>
                原檔：{formatSize(conflict?.oldFile.size ?? 0)}；新檔：
                {formatSize(conflict?.newFile.size ?? 0)}
              </p>
              <p style={{ overflowWrap: 'anywhere' }}>
                共存將命名為「{conflict?.newName}
                」。取消僅略過這個新檔案，其他檔案會繼續處理。
              </p>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => chooseConflict('cancel')}>取消</Button>
              <Button onClick={() => chooseConflict('replace')}>替代</Button>
              <Button
                appearance="primary"
                onClick={() => chooseConflict('keep')}
              >
                共存
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

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
          <a
            href="https://github.com/gildas-lormeau/zip.js"
            target="_blank"
            rel="noreferrer"
          >
            zip.js
          </a>
        </small>
      </p>
    </div>
  )
}
