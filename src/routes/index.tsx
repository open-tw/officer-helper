import {
  Caption1,
  Card,
  CardHeader,
  Subtitle2,
  Text,
  createFocusOutlineStyle,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import { ShieldCheckmarkRegular } from '@fluentui/react-icons'
import { Link, createFileRoute } from '@tanstack/react-router'
import { PageIntro } from '#/components/page-intro'
import { TOOL_GROUPS } from '#/libs/tools'
import type { Tool } from '#/libs/tools'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: '辦公室小幫手' },
      {
        name: 'description',
        content: '辦公室常用的小工具，檔案全部在瀏覽器內處理，不會上傳。',
      },
    ],
  }),
  component: Home,
})

const useStyles = makeStyles({
  privacy: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalXS,
    color: tokens.colorPaletteGreenForeground1,
  },
  section: {
    marginBottom: tokens.spacingVerticalXXL,
  },
  sectionTitle: {
    display: 'block',
    marginBottom: tokens.spacingVerticalM,
    color: tokens.colorNeutralForeground2,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: tokens.spacingHorizontalL,
    margin: 0,
    padding: 0,
    listStyle: 'none',
  },
  // Card 本身只能是 div，由外層 <a> 負責導覽，才能中鍵 / 右鍵開新分頁
  link: {
    display: 'block',
    position: 'relative',
    height: '100%',
    color: 'inherit',
    textDecoration: 'none',
    borderRadius: tokens.borderRadiusMedium,
    ...createFocusOutlineStyle(),
  },
  card: {
    height: '100%',
    transitionProperty: 'box-shadow, background-color',
    transitionDuration: tokens.durationFaster,
    ':hover': {
      boxShadow: tokens.shadow8,
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  iconBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    fontSize: '24px',
    borderRadius: tokens.borderRadiusMedium,
    color: tokens.colorBrandForeground1,
    backgroundColor: tokens.colorBrandBackground2,
  },
  description: {
    color: tokens.colorNeutralForeground3,
  },
})

function ToolCard({ tool }: { tool: Tool }) {
  const styles = useStyles()
  const Icon = tool.icon
  return (
    <Link to={tool.to} className={styles.link}>
      <Card className={styles.card}>
        <CardHeader
          image={
            <span className={styles.iconBox} aria-hidden>
              <Icon />
            </span>
          }
          header={<Subtitle2>{tool.title}</Subtitle2>}
          description={
            <Caption1 className={styles.description}>
              {tool.description}
            </Caption1>
          }
        />
      </Card>
    </Link>
  )
}

function Home() {
  const styles = useStyles()
  return (
    <>
      <PageIntro
        title="今天要處理什麼？"
        description="一組辦公室常用的小工具，打開就能用，不需要安裝軟體。"
      >
        <Text size={200} className={styles.privacy}>
          <ShieldCheckmarkRegular fontSize={16} aria-hidden />
          所有檔案都在你的瀏覽器內處理，不會上傳到任何伺服器。
        </Text>
      </PageIntro>

      {TOOL_GROUPS.map((group) => (
        <section key={group.title} className={styles.section}>
          <Subtitle2 as="h2" className={styles.sectionTitle}>
            {group.title}
          </Subtitle2>
          <ul className={styles.grid}>
            {group.tools.map((tool) => (
              <li key={tool.to}>
                <ToolCard tool={tool} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}
