import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'
import { readdir, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackRouter } from '@tanstack/router-plugin/vite'

import viteReact from '@vitejs/plugin-react'

/** Keep PDF.js support files on our own origin, with their original filenames. */
function pdfJsAssets(base: string): Plugin {
  const root = dirname(
    createRequire(import.meta.url).resolve('pdfjs-dist/package.json'),
  )
  const directories = ['cmaps', 'standard_fonts', 'wasm', 'iccs']
  const files = new Map<string, string>()
  return {
    name: 'local-pdfjs-assets',
    async buildStart() {
      for (const directory of directories) {
        for (const entry of await readdir(join(root, directory), {
          withFileTypes: true,
        })) {
          if (entry.isFile())
            files.set(
              `${directory}/${entry.name}`,
              join(root, directory, entry.name),
            )
        }
      }
    },
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = new URL(request.url || '/', 'http://localhost')
          .pathname
        const prefix = `${base}pdfjs/`
        if (!pathname.startsWith(prefix)) return next()
        const file = files.get(pathname.slice(prefix.length))
        if (!file) return next()
        try {
          const bytes = await readFile(file)
          response.setHeader(
            'Content-Type',
            file.endsWith('.wasm')
              ? 'application/wasm'
              : file.endsWith('.js')
                ? 'text/javascript'
                : 'application/octet-stream',
          )
          response.end(bytes)
        } catch (error) {
          next(error)
        }
      })
    },
    async generateBundle() {
      for (const [name, path] of files) {
        this.emitFile({
          type: 'asset',
          fileName: `pdfjs/${name}`,
          source: await readFile(path),
        })
      }
    },
  }
}

const config = defineConfig(({ mode }) => {
  // 部署在子路徑時用 .env 的 VITE_BASE_PATH 帶入，未設定就是根路徑。
  // 頭尾斜線都補齊，所以填 officer-helper 或 /officer-helper 都可以。
  const { VITE_BASE_PATH } = loadEnv(mode, process.cwd(), 'VITE_')
  const basePath = (VITE_BASE_PATH || '').replace(/^\/+|\/+$/g, '')
  const base = basePath ? `/${basePath}/` : '/'

  return {
    base,
    resolve: { tsconfigPaths: true },
    plugins: [
      pdfJsAssets(base),
      devtools(),
      tanstackRouter({ target: 'react', autoCodeSplitting: true }),
      viteReact(),
    ],
  }
})

export default config
