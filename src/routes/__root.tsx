// import {
//   // Box,
//   ChakraProvider,
//   ClientOnly,
//   // Flex,
//   // HStack,
//   // Skeleton,
//   defaultSystem,
//   Skeleton,
// } from '@chakra-ui/react'
import {
  FluentProvider,
  webLightTheme,
  Button,
} from '@fluentui/react-components'
// import { ThemeProvider } from 'next-themes'
import { HeadContent, Outlet, createRootRoute } from '@tanstack/react-router'

import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import '../styles.css'
// import { ColorModeToggle } from '#/components/ui/color-mode'
// import { Provider } from '#/components/ui/provider'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <>
      <HeadContent />
      {/* <ChakraProvider value={defaultSystem}> */}
      {/* <ThemeProvider attribute="class" disableTransitionOnChange> */}
      {/* <Provider> */}
      {/* <ClientOnly fallback={<Skeleton w="10" h="10" rounded="md" />}> */}
      {/* <ColorModeToggle /> */}
      {/* </ClientOnly> */}
      <FluentProvider theme={webLightTheme}>
        <Outlet />
      </FluentProvider>
      {/* </ThemeProvider> */}
      {/* </ChakraProvider> */}
      {/* </Provider> */}
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
