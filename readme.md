# THU 必修科目表擷取器

一個專為 **東海大學學生** 設計的 Chrome 擴充功能，能夠從學校官網自動擷取與分析「必修科目表」與「歷年成績」，並提供學分比對、修課狀態檢查與 CSV 匯出功能。

![screenshot](image/screenshot0.png)
![screenshot](image/screenshot1.png)
---

## 🔧 功能簡介

- ✅ 自動擷取並解析 **最新學年度的必修科目表**
- 📋 擷取「歷年成績」頁面的課程資料
- 📊 進行學分比對：列出
  - ✅ 已通過的必修
  - ❌ 尚未通過的必修
  - ⚠️ 未列於必修清單但已通過的課程（可能為選修）
- 📤 支援 **CSV 匯出**，包括：
  - 原始必修表
  - 學分比對摘要
  - 完整修課紀錄（含 GPA）
- 🔁 動態支援多學制、多學系（自動載入選單）
- 🎉 完成所有必修時顯示提示訊息

---

## 🖼 使用方式

1. 安裝此擴充套件
2. 點擊擴充套件圖示開啟主視窗
3. 選擇學年度、學制、學系後點擊「查詢」
4. 可按「學分比對」自動擷取【歷年成績】頁面的成績資料，並與必修進行比對
5. 點擊「匯出 CSV」即可下載完整比對結果

---

## 📦 安裝方式（開發者模式）

1. 下載或 Clone 本專案：
   ```bash
   git clone https://github.com/yourname/thu-mustlist-extension.git
   ```
2. 開啟 Chrome > `chrome://extensions/`
3. 開啟右上角「開發者模式」
4. 點擊「載入未封裝項目」，選擇專案資料夾
5. 完成安裝，即可開始使用！

---

## 🔒 權限說明

本擴充功能僅存取以下網站資料：

- `https://fsis.thu.edu.tw/*`：東海大學課程與成績資訊系統

其餘資料不會被擷取，所有資料處理僅在本機完成，**不會上傳至任何伺服器**。

---

## 🛠 技術架構

- `Manifest V3` 擴充架構【背景執行：`service_worker.js`】【UI：`popup.html` + `popup.js`】
- 動態 DOM 解析：HTML 原始碼轉換為可處理表格資料
- 成績比對演算法包含正規化處理（例如「專題（一）」「專題(一)」統一比對）

---

## 📁 專案結構

| 檔案 | 說明 |
|------|------|
| `manifest.json` | 擴充功能設定檔 |
| `popup.html` | 擴充視窗 UI 結構 |
| `popup.js` | 核心邏輯與比對流程 |
| `service_worker.js` | 背景處理 API 請求 |
| `styles.css` | UI 樣式表 |

---

## 🧪 測試與相容性

- ✅ 已測試：Chrome 桌面版 115+
- ⚠️ 若網站 HTML 結構異動，可能需調整 `popup.js` 中的 `parseMustTable` 或 `scrapeTranscriptFromActiveTab` 方法
- 💻 本專案提供 GitHub Codespaces 開發環境，使用官方 Playwright 映像 `mcr.microsoft.com/playwright:v1.54.0-noble`。進入 Codespace 後會自動執行 `npm ci` 安裝依賴。
- 🧪 在 Codespace 中可透過以下指令執行測試並開啟報告：
  ```bash
  npm test        # 執行 Playwright 測試
  npm run report  # 開啟測試報告
  ```
