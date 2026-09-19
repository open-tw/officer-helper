import { seo } from '#/libs/seo'
import { Button, Input, Select } from '@fluentui/react-components'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import QRCode from 'react-qr-code'

export const Route = createFileRoute('/qr-code')({
  head: () => ({
    meta: [
      ...seo({
        title: 'QR Code產生器',
      }),
    ],
  }),
  component: RouteComponent,
})

const SIZES = [64, 128, 512] as const
const LEVELS = ['L', 'M', 'Q', 'H'] as const

type Size = (typeof SIZES)[number]
type Level = (typeof LEVELS)[number]

type QRSettings = {
  value: string
  bgColor: string
  level: Level
  size: Size
}

function RouteComponent() {
  const [value, setValue] = useState('https://')
  const [bgColor, setBgColor] = useState('#ffffff')
  const [level, setLevel] = useState<Level>('M')
  const [size, setSize] = useState<Size>(128)
  const [settings, setSettings] = useState<QRSettings | null>(null)

  const generate = () => {
    if (!value.trim()) return
    setSettings({ value, bgColor, level, size })
  }

  const downloadQR = () => {
    const svg = document.getElementById('qrcode')
    if (!svg || !settings) return

    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.onload = () => {
      canvas.width = settings.size
      canvas.height = settings.size
      ctx.drawImage(img, 0, 0, settings.size, settings.size)

      const downloadLink = document.createElement('a')
      downloadLink.download = 'qrcode.png'
      downloadLink.href = canvas.toDataURL('image/png')
      downloadLink.click()
    }

    const bytes = new TextEncoder().encode(svgData)
    const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join('')
    img.src = 'data:image/svg+xml;base64,' + btoa(binary)
  }

  return (
    <div>
      <Input
        value={value}
        placeholder="請輸入網址"
        onChange={(e) => setValue(e.target.value)}
      />

      <Select value={level} onChange={(e) => setLevel(e.target.value as Level)}>
        {LEVELS.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </Select>
      <Button onClick={generate} disabled={!value.trim()}>
        產生 QR Code
      </Button>

      {settings && (
        <>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem', // Chakra 的 3 = 12px
            }}
          >
            <div
              style={{
                backgroundColor: settings.bgColor,
                padding: '0.75rem',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: '#E2E8F0', // Chakra 預設的 gray.200
                width: '100%',
                maxWidth: '256px',
                marginLeft: 'auto',
                marginRight: 'auto',
                boxSizing: 'border-box',
              }}
            >
              <QRCode
                id="qrcode"
                value={settings.value}
                size={settings.size}
                bgColor={settings.bgColor}
                level={settings.level}
                style={{ height: 'auto', width: '100%', maxWidth: '100%' }}
                viewBox={`0 0 ${settings.size} ${settings.size}`}
              />
            </div>
            <Button appearance="primary" onClick={downloadQR}>
              下載 PNG
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

// import {
//   Box,
//   Breadcrumb,
//   Button,
//   Container,
//   Field,
//   HStack,
//   Input,
//   NativeSelect,
//   Stack,
//   Textarea,
// } from '@chakra-ui/react'
// import { createFileRoute, Link } from '@tanstack/react-router'
// import { useState } from 'react'
// import { BiHome } from 'react-icons/bi'
// import QRCode from 'react-qr-code'

// export const Route = createFileRoute('/qr-code')({
//   head: () => ({
//     meta: [
//       {
//         title: 'QR Code產生器',
//       },
//     ],
//   }),
//   component: RouteComponent,
// })

// const SIZES = [64, 128, 512] as const
// const LEVELS = ['L', 'M', 'Q', 'H'] as const

// type Size = (typeof SIZES)[number]
// type Level = (typeof LEVELS)[number]

// type QRSettings = {
//   value: string
//   bgColor: string
//   level: Level
//   size: Size
// }

// function RouteComponent() {
//   const [value, setValue] = useState('')
//   const [bgColor, setBgColor] = useState('#ffffff')
//   const [level, setLevel] = useState<Level>('M')
//   const [size, setSize] = useState<Size>(128)
//   const [settings, setSettings] = useState<QRSettings | null>(null)

//   const generate = () => {
//     if (!value.trim()) return
//     setSettings({ value, bgColor, level, size })
//   }

//   const downloadQR = () => {
//     const svg = document.getElementById('qrcode')
//     if (!svg || !settings) return

//     const svgData = new XMLSerializer().serializeToString(svg)
//     const canvas = document.createElement('canvas')
//     const ctx = canvas.getContext('2d')
//     if (!ctx) return

//     const img = new Image()
//     img.onload = () => {
//       canvas.width = settings.size
//       canvas.height = settings.size
//       ctx.drawImage(img, 0, 0, settings.size, settings.size)

//       const downloadLink = document.createElement('a')
//       downloadLink.download = 'qrcode.png'
//       downloadLink.href = canvas.toDataURL('image/png')
//       downloadLink.click()
//     }

//     const bytes = new TextEncoder().encode(svgData)
//     const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join('')
//     img.src = 'data:image/svg+xml;base64,' + btoa(binary)
//   }

//   return (
//     <Container fluid maxW={'5xl'} px={'4'}>
//       <Breadcrumb.Root>
//         <Breadcrumb.List>
//           <Breadcrumb.Item>
//             <Breadcrumb.Link asChild>
//               <Link to="/">
//                 <BiHome />
//                 Home
//               </Link>
//             </Breadcrumb.Link>
//           </Breadcrumb.Item>
//           <Breadcrumb.Separator />
//           <Breadcrumb.Item>
//             <Breadcrumb.CurrentLink>QR Code</Breadcrumb.CurrentLink>
//           </Breadcrumb.Item>
//         </Breadcrumb.List>
//       </Breadcrumb.Root>

//       <Stack gap={'4'} mt={'6'} maxW={'2xl'}>
//         <Field.Root>
//           <Field.Label>內容</Field.Label>
//           <Input
//             value={value}
//             placeholder="請輸入網址"
//             onChange={(e) => setValue(e.target.value)}
//           />
//         </Field.Root>

//         <HStack gap={'4'} align={'flex-end'} wrap={'wrap'}>
//           <Field.Root maxW={'32'}>
//             <Field.Label>背景色</Field.Label>
//             <Input
//               type="color"
//               value={bgColor}
//               p={'1'}
//               onChange={(e) => setBgColor(e.target.value)}
//             />
//           </Field.Root>

//           <Field.Root maxW={'40'}>
//             <Field.Label>容錯率</Field.Label>
//             <NativeSelect.Root>
//               <NativeSelect.Field
//                 value={level}
//                 onChange={(e) => setLevel(e.target.value as Level)}
//               >
//                 {LEVELS.map((l) => (
//                   <option key={l} value={l}>
//                     {l}
//                   </option>
//                 ))}
//               </NativeSelect.Field>
//               <NativeSelect.Indicator />
//             </NativeSelect.Root>
//           </Field.Root>

//           <Field.Root maxW={'40'}>
//             <Field.Label>尺寸</Field.Label>
//             <NativeSelect.Root>
//               <NativeSelect.Field
//                 value={size}
//                 onChange={(e) => setSize(Number(e.target.value) as Size)}
//               >
//                 {SIZES.map((s) => (
//                   <option key={s} value={s}>
//                     {s} x {s}
//                   </option>
//                 ))}
//               </NativeSelect.Field>
//               <NativeSelect.Indicator />
//             </NativeSelect.Root>
//           </Field.Root>
//         </HStack>

//         <Box>
//           <Button onClick={generate} disabled={!value.trim()}>
//             產生 QR Code
//           </Button>
//         </Box>

//         {settings && (
//           <Stack gap={'3'} align={'center'}>
//             <Box
//               bg={settings.bgColor}
//               p={'3'}
//               borderWidth={'1px'}
//               w={'full'}
//               maxW={'256px'}
//               mx={'auto'}
//             >
//               <QRCode
//                 id="qrcode"
//                 value={settings.value}
//                 size={settings.size}
//                 bgColor={settings.bgColor}
//                 level={settings.level}
//                 style={{ height: 'auto', width: '100%', maxWidth: '100%' }}
//                 viewBox={`0 0 ${settings.size} ${settings.size}`}
//               />
//             </Box>
//             <Button variant={'outline'} onClick={downloadQR}>
//               下載 PNG
//             </Button>
//           </Stack>
//         )}
//       </Stack>
//     </Container>
//   )
// }
