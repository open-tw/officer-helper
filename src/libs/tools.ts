import type { FluentIcon } from '@fluentui/react-icons'
import {
  ArrowSyncRegular,
  FolderZipRegular,
  ImageRegular,
  QrCodeRegular,
} from '@fluentui/react-icons'
import type { FileRouteTypes } from '#/routeTree.gen'

/**
 * 所有工具的單一來源。
 * 新增工具時在這裡加一筆，首頁就會自動出現對應的卡片。
 */
export type Tool = {
  to: Exclude<FileRouteTypes['to'], '/'>
  title: string
  description: string
  icon: FluentIcon
}

export type ToolGroup = {
  title: string
  tools: Tool[]
}

export const TOOL_GROUPS: ToolGroup[] = [
  {
    title: '通用工具',
    tools: [
      {
        to: '/qr-code',
        title: 'QR Code 產生器',
        description: '輸入網址或文字，產生可下載的 QR Code 圖片',
        icon: QrCodeRegular,
      },
      {
        to: '/zip',
        title: '壓一起',
        description: '把多個檔案打包成一個 .zip，方便寄送或上傳',
        icon: FolderZipRegular,
      },
      {
        to: '/img/compressor',
        title: '圖片壓縮',
        description: '縮小照片檔案大小，方便夾帶在信件或上傳系統',
        icon: ImageRegular,
      },
    ],
  },
  {
    title: '轉換工具',
    tools: [
      {
        to: '/export/xls',
        title: 'XLS 轉換',
        description: '把舊版 Excel 的 .xls 轉成 .xlsx、.ods 或 .csv',
        icon: ArrowSyncRegular,
      },
    ],
  },
]
