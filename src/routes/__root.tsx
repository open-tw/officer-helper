import {
  FluentProvider,
  Text,
  createFocusOutlineStyle,
  makeStyles,
  tokens,
  webLightTheme,
} from '@fluentui/react-components'
import type { Theme } from '@fluentui/react-components'
import { WrenchRegular } from '@fluentui/react-icons'
import {
  HeadContent,
  Link,
  Outlet,
  createRootRoute,
} from '@tanstack/react-router'

import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import '../styles.css'

export const Route = createRootRoute({
  component: RootComponent,
})

// Fluent 預設字型堆疊沒有中文字型，補上繁中常見字型
const CJK_FONTS =
  "'Segoe UI', 'Microsoft JhengHei', 'PingFang TC', 'Noto Sans TC', -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', sans-serif"

const theme: Theme = {
  ...webLightTheme,
  fontFamilyBase: CJK_FONTS,
}

const useStyles = makeStyles({
  shell: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: tokens.colorNeutralBackground2,
  },
  header: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  headerInner: {
    maxWidth: '1080px',
    margin: '0 auto',
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    boxSizing: 'border-box',
  },
  brand: {
    display: 'inline-flex',
    position: 'relative',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalS,
    color: tokens.colorNeutralForeground1,
    textDecoration: 'none',
    borderRadius: tokens.borderRadiusMedium,
    ...createFocusOutlineStyle(),
  },
  brandIcon: {
    fontSize: '24px',
    color: tokens.colorBrandForeground1,
  },
  main: {
    flex: 1,
    width: '100%',
    maxWidth: '1080px',
    margin: '0 auto',
    padding: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalL}`,
    boxSizing: 'border-box',
  },
})

function RootComponent() {
  const styles = useStyles()
  return (
    <>
      <HeadContent />
      <FluentProvider theme={theme}>
        <div className={styles.shell}>
          <header className={styles.header}>
            <div className={styles.headerInner}>
              <Link to="/" className={styles.brand}>
                <WrenchRegular className={styles.brandIcon} aria-hidden />
                <Text weight="semibold" size={400}>
                  辦公室小幫手
                </Text>
              </Link>
            </div>
          </header>
          <main className={styles.main}>
            <Outlet />
          </main>
        </div>
      </FluentProvider>
      <TanStackDevtools
        config={{
          position: 'bottom-right',
        }}
        plugins={[
          {
            name: 'TanStack Router',
            render: <TanStackRouterDevtoolsPanel />,
          },
        ]}
      />
    </>
  )
}
