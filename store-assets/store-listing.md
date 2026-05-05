# Chrome Web Store 上架資料

---

## 擴充功能名稱（Name）
0050 ETF 價值換算

---

## 簡短說明（Short description，≤132 字元）
在所有購物網站的價格旁，即時顯示等值 ETF 股數及依歷史報酬率推估的增值參考。不構成投資建議。

---

## 完整說明（Description）

**每次購物前，先想想這筆錢放進 ETF 會變多少。**

安裝後，瀏覽任何購物網站（PChome、momo、蝦皮、Shopee、博客來、Yahoo 購物⋯⋯）時，每個價格旁邊會自動出現一個綠色標籤，顯示這筆錢能買多少股指定的 ETF 或股票。

滑鼠懸停在標籤上，立刻展開詳細面板：

✅ 目前股價（每小時更新）
✅ 近 1 年年化報酬率（歷史資料）
✅ 等值股數（精確到小數三位）
✅ 依歷史報酬率推估的 3 個月後參考金額
✅ 依歷史報酬率推估的 1 年後參考金額

---

**使用方式**

1. 安裝後直接生效，不需任何設定
2. 到任意購物網站，價格旁會出現「≈XX.XX股」的綠色標籤
3. 懸停標籤查看完整試算
4. 點擊工具列圖示可切換比較標的（支援台股、美股、自訂代號）

---

**技術說明**

- 資料來源：Yahoo Finance 歷史股價資料
- 快取機制：每小時更新一次，減少 API 請求
- 離線備援：若無法連線，顯示預設值並標示警告
- 隱私：不收集、不傳送任何使用者資料或瀏覽記錄

---

**適合對象**

- 正在培養投資習慣、想建立「機會成本意識」的人
- 長期定期定額 ETF 的投資人
- 想在消費衝動時自動踩一個煞車的人

---

**免責聲明**

本擴充功能顯示的數據均來自 Yahoo Finance 歷史股價資料，所有推估金額係依過去一年報酬率進行機械式計算，**僅供參考，不代表未來實際報酬**。過去績效不保證未來結果，市場價格可能上漲或下跌。本工具之任何內容均不構成投資建議、買賣有價證券之邀約或推薦，使用者應自行評估風險並為投資決策負責。

---

## 類別（Category）
工具（Tools）

## 語言（Language）
繁體中文（zh-TW）

---

## 上架檢查清單

### 必要素材
- [x] icon16.png
- [x] icon48.png
- [x] icon128.png
- [x] 截圖1：購物頁面上的 badge + tooltip（screenshot1.html → 截圖為 1280×800）
- [x] 截圖2：Popup 面板與功能說明（screenshot2.html → 截圖為 1280×800）

### 截圖方式
1. 用 Chrome 開啟 screenshot1.html / screenshot2.html
2. 視窗設為 1280×800（DevTools → 右上角裝置模擬，輸入 1280×800）
3. 按 Cmd+Shift+P → 輸入 "Capture screenshot" → 存為 PNG

### 上架步驟
1. 前往 https://chrome.google.com/webstore/devconsole
2. 支付 $5 USD 開發者費用（一次性）
3. 點「新增項目」→上傳整個 etf-price-extension 資料夾的 .zip
4. 填入上方名稱、說明文字
5. 上傳 icon128.png 作為商店圖示
6. 上傳兩張截圖
7. 隱私設定：選「不收集使用者資料」
8. 送出審核（通常 1–3 個工作天）

### 打包指令
```bash
cd /Users/dingguanwei
zip -r etf-price-extension.zip etf-price-extension/ \
  --exclude "*/store-assets/*" \
  --exclude "*/.DS_Store"
```
