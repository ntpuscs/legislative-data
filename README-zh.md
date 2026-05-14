# 國立臺北大學學生自治立法資料庫 

[English](README.md) | [繁體中文](README-zh.md)

這個儲存庫是國立臺北大學學生議會（三峽校區）的立法資料與自動化工作流中心。

本專案將議事資料（如議案、委員會報告、法規）與[前端網頁應用程式](https://github.com/ntpusu/open-parliament)完全解耦，作為獨立的資料供應來源。透過自動化腳本定期更新結構化資料（多為 JSON），確保官方網站及其他應用程式能取得最新且穩定之議事紀錄。

## 儲存庫架構

本儲存庫採扁平化結構設計，主要區分為自動化工作流、執行腳本與資料儲存三部分：

* **`.github/workflows/`**
    包含 GitHub Actions 排程腳本，負責定期觸發資料更新任務。
* **`scripts/`**
    存放負責實際執行資料獲取與轉換之 Node.js 腳本。
* **`data/`**
    存放由腳本生成之最新結構化議事資料，例如：
    * `bill_latestTerm.json`：最新屆次之議案資料。
    * `bill_pastTerms.json`：歷屆之議案資料歸檔。
    * `committeeReports.json`：各委員會政策建議報告與學生會回覆。
    * `bylaw-list.json`：自治法規清單。
    * `bylaws/**.md`：自治法規文字檔。

## 自動化工作流機制

本專案利用 GitHub Actions 進行資料的自動化維護。排程任務會定期執行 `scripts/` 目錄下的程式，自動從 Google Workplaces 獲取並處理最新議事內容。

當腳本比對發現資料有實質更新時，GitHub Actions 會自動將變更寫入 `data/` 目錄中的 JSON 檔案，並自動產生 Commit 推送至本儲存庫，確保資料庫狀態常保最新，減少人工介入維護之成本。

## 系統整合與資料獲取

本專案本身不包含前端渲染邏輯。主專案（如議會官方網站前端）或其他授權之應用程式，應透過 **jsDelivr CDN** 獲取本儲存庫 `data/` 目錄下之 JSON 檔案。jsDelivr 會自動鏡像本儲存庫之 `main` 分支，並提供穩定的全球節點加速。

**建議使用之 CDN 基礎 URL：**
```
https://cdn.jsdelivr.net/gh/ntpusu/legislative-data@main/data/{filename}
```

**實作建議（開發者請注意）：**
由於本儲存庫每日更新，每次資料更新後將透過 GitHub Actions 自動呼叫 jsDelivr 清除快取（Cache Purge），確保資料即時性。爰不建議正式環境中直接使用 GitHub 原生 Raw URL，以免過度消耗頻寬，觸發可能的請求限制。若主專案仍有進一步的快取需求，似可考慮於伺服器端（如 Nuxt Server API）額外實作應用層快取。

## 維護單位

本儲存庫的資料，由國立臺北大學學生議會秘書處負責管理與維護。自動化腳本之調整或系統架構變更，委由學生自治會總會秘書處協辦。