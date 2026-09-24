# 辦公室小幫手

一組辦公室常用的小工具，全部在瀏覽器內完成處理。

**所有檔案都不會上傳到任何伺服器。** 這個專案沒有後端 —— 檔案的讀取、轉換、壓縮全部在使用者自己的瀏覽器裡跑完，關掉分頁就結束了。

## 工具一覽

| 工具           | 路徑              | 說明                                                  |
| -------------- | ----------------- | ----------------------------------------------------- |
| QR Code 產生器 | `/qr-code`        | 輸入網址或文字產生 QR Code，可選容錯率，下載成 PNG    |
| 壓一起         | `/zip`            | 選取或拖曳多個檔案，打包成單一 `.zip` 下載            |
| 圖片壓縮       | `/img/compressor` | 批次縮小圖片檔案大小，可單張下載或打包成 `.zip`       |
| XLS 轉換       | `/export/xls`     | 把舊版 Excel 的 `.xls` 轉成 `.xlsx`、`.ods` 或 `.csv` |
| 海報分割列印   | `/pdf/poster`     | 將 PDF 放大成 2／4／8 張 A4 或 A3，列印後拼貼         |

## 開發

建議使用 Node.js 24；PDF.js 需要 Node.js 22.13 以上的相容版本。

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
| `npm run test:poster`     | 海報排版、PDF 輸出及渲染比對測試  |
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
- **[browser-image-compression](https://github.com/Donaldcwl/browser-image-compression)** — 圖片壓縮
- **[pdf-lib](https://pdf-lib.js.org/)** — PDF 海報分割輸出
- **[PDF.js](https://mozilla.github.io/pdf.js/)** — PDF 預覽；渲染測試使用其可選依賴 `@napi-rs/canvas`，安裝時請保留 optional dependencies

> `xlsx` 這個套件是從 SheetJS 官方 CDN 安裝（不是 npm registry），這是官方建議的做法。若建置環境無法連外或使用內部 registry，需要先處理這個依賴。

> `browser-image-compression` 在 Web Worker 內預設會從 jsDelivr 載入自己。本專案已改為載入站內副本（`src/routes/img/compressor.tsx` 的 `libURL`），因此執行時不會對外連線，內網環境也能正常運作。

## 專案結構

```
src/
├── routes/                  # 檔案式路由，檔名即網址
│   ├── __root.tsx           # 共用外層（FluentProvider 與頁首在這裡）
│   ├── index.tsx            # 首頁，卡片由 libs/tools.ts 自動產生
│   ├── qr-code.tsx
│   ├── zip.tsx
│   ├── img/compressor.tsx
│   ├── pdf/poster.tsx
│   └── export/xls.tsx
├── components/              # 跨頁共用元件（PageIntro、ColorPickerPopup）
├── libs/
│   ├── tools.ts             # 工具清單的單一來源，首頁讀這裡
│   └── seo.ts               # 產生頁面 meta 標籤
├── routeTree.gen.ts         # 自動產生，不要手動改
├── router.tsx               # router 設定（basepath 在這裡）
└── main.tsx                 # 進入點
```

新增工具分兩步：

1. 在 `src/routes/` 放一個新的 `.tsx`，開發伺服器會自動更新 `routeTree.gen.ts`
2. 在 `src/libs/tools.ts` 的 `TOOL_GROUPS` 加一筆，首頁就會自動出現對應卡片

## 部署

建置產物是純靜態檔案，`dist/` 直接丟到任何靜態主機即可。但有兩件事必須先確認：

### 1. 部署在子路徑時要設定 `VITE_BASE_PATH`

預設產出的資產路徑是絕對路徑（`/assets/...`），只適用於放在網域根目錄。若要放在子路徑（例如 `example.gov.tw/officer-helper/`），建置前設定環境變數即可：

```bash
# .env.production
VITE_BASE_PATH=/officer-helper/
```

頭尾斜線會自動補齊，填 `officer-helper` 或 `/officer-helper` 也可以。未設定時就是根路徑。

`vite.config.ts` 的 `base` 與 `src/router.tsx` 的 `basepath` 都讀這個值，不需要分別修改。可參考 `.env.example`。

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

部署在子路徑時，fallback 的目標要跟著改成該路徑下的 `index.html`：

```nginx
location /officer-helper/ {
  try_files $uri $uri/ /officer-helper/index.html;
}
```
