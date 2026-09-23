import { defineConfig, loadEnv } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackRouter } from '@tanstack/router-plugin/vite'

import viteReact from '@vitejs/plugin-react'

const config = defineConfig(({ mode }) => {
  // 部署在子路徑時用 .env 的 VITE_BASE_PATH 帶入，未設定就是根路徑。
  // 頭尾斜線都補齊，所以填 officer-helper 或 /officer-helper 都可以。
  const { VITE_BASE_PATH } = loadEnv(mode, process.cwd(), 'VITE_')
  const base = VITE_BASE_PATH
    ? `/${VITE_BASE_PATH.replace(/^\/+|\/+$/g, '')}/`
    : '/'

  return {
    base,
    resolve: { tsconfigPaths: true },
    plugins: [
      devtools(),
      tanstackRouter({ target: 'react', autoCodeSplitting: true }),
      viteReact(),
    ],
  }
})

export default config
