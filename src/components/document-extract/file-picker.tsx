import { useId, useRef, useState } from 'react'
import {
  Body1,
  Button,
  Caption1,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import { DocumentRegular } from '@fluentui/react-icons'

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingVerticalXXL,
    border: `2px dashed ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    textAlign: 'center',
    overflowWrap: 'anywhere',
  },
  icon: { fontSize: '40px', color: tokens.colorNeutralForeground3 },
  actions: { display: 'flex', gap: tokens.spacingHorizontalS },
  error: { color: tokens.colorPaletteRedForeground1 },
})

export type FilePickerProps = {
  file: File | null
  disabled?: boolean
  onFileChange: (file: File | null) => void
}

/** Only selects a document; parsing belongs to the page's processing flow. */
export function FilePicker({
  file,
  disabled = false,
  onFileChange,
}: FilePickerProps) {
  const styles = useStyles()
  const inputRef = useRef<HTMLInputElement>(null)
  const hintId = useId()
  const [error, setError] = useState('')

  const selectFiles = (files: FileList | null) => {
    if (disabled || !files?.length) return
    if (files.length !== 1) {
      setError('請一次選擇一份文件。')
      return
    }
    const picked = files[0]
    if (!/\.(docx|odt)$/i.test(picked.name)) {
      setError('請選擇 DOCX 或 ODT 文件。')
      return
    }
    if (picked.size === 0) {
      setError('這份文件是空的，請重新選擇。')
      return
    }
    setError('')
    onFileChange(picked)
  }

  return (
    <section
      className={styles.root}
      aria-label="選擇文件"
      aria-disabled={disabled}
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = disabled ? 'none' : 'copy'
      }}
      onDrop={(event) => {
        event.preventDefault()
        selectFiles(event.dataTransfer.files)
      }}
    >
      <DocumentRegular className={styles.icon} aria-hidden />
      <Body1>{file ? file.name : '選擇文件，或將文件拖曳到這裡'}</Body1>
      <Caption1 id={hintId}>文件格式：DOCX、ODT，一次一份</Caption1>
      <input
        ref={inputRef}
        type="file"
        accept=".docx,.odt"
        hidden
        disabled={disabled}
        onChange={(event) => {
          selectFiles(event.target.files)
          event.target.value = ''
        }}
      />
      <div className={styles.actions}>
        <Button
          disabled={disabled}
          aria-describedby={hintId}
          onClick={() => inputRef.current?.click()}
        >
          {file ? '更換文件' : '選擇文件'}
        </Button>
        {file && (
          <Button
            disabled={disabled}
            onClick={() => {
              setError('')
              onFileChange(null)
            }}
          >
            清除
          </Button>
        )}
      </div>
      {error && (
        <Body1 role="alert" className={styles.error}>
          {error}
        </Body1>
      )}
    </section>
  )
}
