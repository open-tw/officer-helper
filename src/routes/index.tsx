import {
  // FluentProvider,
  // webLightTheme,
  Button,
} from '@fluentui/react-components'
import {
  QrCodeRegular,
  ArrowSyncRegular,
  FolderZipRegular,
} from '@fluentui/react-icons'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      {
        title: '辦公室小幫手',
      },
    ],
  }),
  component: Home,
})

function Title({ title }: { title: string }) {
  return <h1>{title}</h1>
}

function Home() {
  const navigate = useNavigate()
  return (
    // <Container fluid maxW={'5xl'} px={'4'}>
    <div>
      <h1>通用工具</h1>
      {/* <Link to="/qr-code">QR Code產生器 </Link> */}
      <Button
        onClick={() => {
          navigate({
            to: '/qr-code',
          })
        }}
        icon={<QrCodeRegular />}
      >
        QR Code產生器
      </Button>
      <Button
        onClick={() => {
          navigate({
            to: '/zip',
          })
        }}
        icon={<FolderZipRegular />}
      >
        壓一起
      </Button>
      <Title title="轉換工具" />
      <Button
        onClick={() => {
          navigate({
            to: '/export/xls',
          })
        }}
        icon={<ArrowSyncRegular />}
      >
        XLS轉換
      </Button>
    </div>
  )
}
