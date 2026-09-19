# 辦公室小幫手

一組辦公室常用的小工具，全部在瀏覽器內完成處理。

**所有檔案都不會上傳到任何伺服器。** 這個專案沒有後端 —— 檔案的讀取、轉換、壓縮全部在使用者自己的瀏覽器裡跑完，關掉分頁就結束了。

## 工具一覽

| 工具           | 路徑          | 說明                                                  |
| -------------- | ------------- | ----------------------------------------------------- |
| QR Code 產生器 | `/qr-code`    | 輸入網址或文字產生 QR Code，可選容錯率，下載成 PNG    |
| 壓一起         | `/zip`        | 選取或拖曳多個檔案，打包成單一 `.zip` 下載            |
| XLS 轉換       | `/export/xls` | 把舊版 Excel 的 `.xls` 轉成 `.xlsx`、`.ods` 或 `.csv` |

## 開發

需要 Node.js 20 以上。

```bash
npm install
npm run dev      # http://localhost:3000
```

## 可用指令

| 指令                      | 用途                              |
| ------------------------- | --------------------------------- |
| `npm run dev`             | 啟動開發伺服器（port 3000）       |
| `npm run build`           | 建置到 `dist/`                    |
| `npm run preview`         | 在本機預覽建置結果                |
| `npm run lint`            | ESLint 檢查                       |
| `npm run format`          | Prettier 格式化並自動修正 ESLint  |
| `npm run check`           | 只檢查格式，不修改檔案（適合 CI） |
| `npm run generate-routes` | 手動重新產生路由檔                |

> `npm run build` **不會**做 TypeScript 型別檢查（Vite 只轉譯不檢查）。型別要另外跑 `npx tsc --noEmit`。

## 技術組成

- **[React 19](https://react.dev/)** + **[Vite](https://vite.dev/)**
- **[TanStack Router](https://tanstack.com/router)** — 檔案式路由，路由檔放在 `src/routes/`
- **[Fluent UI v9](https://react.fluentui.dev/)** — UI 元件，配合 Office 使用者習慣
- **[SheetJS](https://sheetjs.com/)** — 試算表格式轉換
- **[zip.js](https://github.com/gildas-lormeau/zip.js)** — 瀏覽器端壓縮

> `xlsx` 這個套件是從 SheetJS 官方 CDN 安裝（不是 npm registry），這是官方建議的做法。若建置環境無法連外或使用內部 registry，需要先處理這個依賴。

## 專案結構

```
src/
├── routes/              # 檔案式路由，檔名即網址
│   ├── __root.tsx       # 共用外層（FluentProvider 在這裡）
│   ├── index.tsx        # 首頁工具選單
│   ├── qr-code.tsx
│   ├── zip.tsx
│   └── export/xls.tsx
├── libs/seo.ts          # 產生頁面 meta 標籤
├── routeTree.gen.ts     # 自動產生，不要手動改
└── main.tsx             # 進入點，router 在這裡建立
```

新增工具：在 `src/routes/` 放一個新的 `.tsx`，開發伺服器會自動更新 `routeTree.gen.ts`，接著在 `src/routes/index.tsx` 的選單加上入口。

## 部署

建置產物是純靜態檔案，`dist/` 直接丟到任何靜態主機即可。但有兩件事必須先確認：

### 1. 部署在子路徑時要設定 `base`

預設產出的資產路徑是絕對路徑（`/assets/...`），只適用於放在網域根目錄。若要放在子路徑（例如 `example.gov.tw/officer-helper/`），必須在 `vite.config.ts` 設定：

```ts
const config = defineConfig({
  base: '/officer-helper/',
  // ...
})
```

並在 `src/main.tsx` 的 `createRouter` 加上對應的 `basepath`，否則路由會對不上。

### 2. 伺服器必須設定 history fallback

這是單頁應用，`/zip`、`/qr-code` 等路徑在伺服器上沒有對應的實體檔案。**若不設定，使用者在子頁面按重新整理、或直接開啟分享的網址都會得到 404。**

伺服器需要將找不到的路徑一律回傳 `index.html`：

```nginx
# Nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

```apache
# Apache
FallbackResource /index.html
```
