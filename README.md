# 神明便利貼

「神明便利貼」是一個使用 Next.js、TypeScript、Tailwind CSS、Prisma CMS 與資料庫建立的品牌形象 + 購物網站初版。風格以可愛 Q 版神明、台灣民間信仰、文創感與乾淨喜氣色系為主。

## 技術

- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma ORM
- SQLite 本機資料庫
- 後台 CMS
- 可部署到 Vercel

## 功能

### 前台

- 首頁
- 關於我們
- 網誌／部落格文章列表
- 單篇文章頁
- 商品分類頁
- 商品列表頁
- 商品詳細頁
- 購物車
- 結帳頁
- 聯絡我們

### 商品

- 商品大分類
- 蝦皮式商品卡資訊：商品圖片、名稱、原價、折扣價、銷量、評價星等、標籤
- 商品詳細頁：多張圖片、商品介紹、規格選項、數量選擇、加入購物車、立即購買

### 購物車與訂單

- 加入購物車
- 修改數量
- 刪除商品
- 小計與總金額
- 結帳建立訂單

### 後台 CMS

進入 `/admin` 可管理：

- 首頁內容
- 關於我們文字
- 聯絡我們文字
- 新增／編輯／刪除部落格文章
- 新增／編輯／刪除商品
- 商品分類管理
- 商品圖片上傳或填寫圖片網址
- 查看訂單
- 修改訂單狀態

## 安裝

```bash
npm install
```

## 建立資料庫與範例資料

```bash
npm run db:push
npm run db:seed
```

## 啟動開發網站

```bash
npm run dev
```

開啟：

```text
http://localhost:3000
```

後台：

```text
http://localhost:3000/admin
```

## 建置

```bash
npm run build
npm run start
```

## 部署到 Vercel

1. 將專案推到 GitHub。
2. 在 Vercel 新增專案並選擇這個 repository。
3. 設定環境變數：

```text
DATABASE_URL=你的正式資料庫連線字串
NEXT_PUBLIC_SITE_URL=https://你的網域
```

4. 正式部署建議使用 Vercel Postgres、Neon、Supabase 或 PlanetScale 類型的雲端資料庫。
5. 若改用 PostgreSQL，請把 `prisma/schema.prisma` 的 datasource provider 從 `sqlite` 改為 `postgresql`，並執行 Prisma migration。

## 圖片上傳說明

目前後台圖片上傳會儲存在 `public/uploads`，適合本機開發與初版展示。Vercel 的檔案系統不適合保存使用者上傳圖片，正式上線時建議改接：

- Vercel Blob
- Cloudinary
- AWS S3
- Supabase Storage

商品圖片也可以直接貼外部圖片網址，多張圖片用逗號分隔。

## 專案結構

```text
app/
  admin/                 後台 CMS
  api/upload/            圖片上傳 API
  blog/                  網誌列表與單篇文章
  cart/                  購物車
  categories/            商品分類
  checkout/              結帳流程
  products/              商品列表與商品詳細
components/              前後台共用元件
lib/                     Prisma、格式化工具、Server Actions
prisma/                  資料庫 schema 與 seed
public/uploads/          本機圖片上傳目錄
```
