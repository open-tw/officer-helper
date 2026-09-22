import { Body1, Title2, makeStyles, tokens } from '@fluentui/react-components'
import type { ReactNode } from 'react'

const useStyles = makeStyles({
  intro: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalXXL,
  },
})

export type PageIntroProps = {
  title: ReactNode
  description?: ReactNode
  /** 補充內容，例如首頁的隱私說明 */
  children?: ReactNode
}

/** 每個頁面開頭的大標題與說明。 */
export function PageIntro({ title, description, children }: PageIntroProps) {
  const styles = useStyles()
  return (
    <div className={styles.intro}>
      <Title2 as="h1">{title}</Title2>
      {description ? <Body1>{description}</Body1> : null}
      {children}
    </div>
  )
}
