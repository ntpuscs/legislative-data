// scripts/fetchRepresentatives.mjs
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import Papa from 'papaparse';

// 學代名冊 Google 試算表的 ID
const SPREADSHEET_ID = '160GDmRWGq1_lM3w0gGgTPHdJG3hztyJog8rEIOFkaKs';

const SHEETS = {
  meetings: { gid: '329615512', name: '01-會議基本資料' },
  representatives: { gid: '163829263', name: '02-學代基本資料' },
  assignments: { gid: '1123889444', name: '03-會議學代名單' }
};

const OUTPUT_DIR = './data';
const OUTPUT_PATH = `${OUTPUT_DIR}/representatives.json`;

/**
 * 從 Google 試算表下載特定工作表並解析為陣列
 * 給定參數 - 字串 gid - 工作表的 GID (Google Sheet ID)
 * 返回解析後的 CSV 資料（標題列移除），作為陣列
 */
async function fetchSheet(gid) {
  
  const initialUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${gid}`;
  
  return new Promise((resolve, reject) => {
    /**
     * 遞迴發送請求的內部函式 (用來處理 Google 服務常見的 302/307 轉址)
     * @param {string} url - 當前要請求的網址
     */
    const sendRequest = (url) => {
      https.get(url, (res) => {
        // 情況 1: 遇到轉址 (狀態碼落在 3xx 且 headers 中有 location)
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          sendRequest(res.headers.location); // 追隨新網址繼續請求
          return;
        }

        // 情況 2: 發生錯誤 (狀態碼大於等於 400)
        if (res.statusCode >= 400) {
          reject(new Error(`請求失敗，狀態碼: ${res.statusCode}`));
          return;
        }

        // 情況 3: 成功取得資料，開始收集數據片段
        let data = '';
        res.on('data', chunk => { data += chunk; });
        
        // 數據收集完畢後進行解析
        res.on('end', () => {
          // 使用 PapaParse 解析 CSV，忽略空行且不將第一行視為 key
          const parsed = Papa.parse(data, { header: false, skipEmptyLines: true });
          
          // 移除第一列 (通常是欄位名稱的標題列)，只回傳純資料陣列
          const dataRows = parsed.data.length > 0 ? parsed.data.slice(1) : [];
          resolve(dataRows);
        });
      }).on('error', reject);
    };

    // 啟動第一次請求
    sendRequest(initialUrl);
  });
}

/**
 * 讀取本地現有的 JSON 檔案，用以判斷資料是否有變動
 * @returns {Object|null} 去除 lastUpdated 欄位後的資料物件，若檔案不存在則回傳 null
 */
function loadExistingData() {
  try {
    if (!fs.existsSync(OUTPUT_PATH)) {
      console.log('本地檔案不存在，這可能是第一次執行，將建立新檔案。');
      return null;
    }

    const content = fs.readFileSync(OUTPUT_PATH, 'utf8');
    const data = JSON.parse(content);
    
    // 移除時間戳記 (lastUpdated) 以便只比較純資料內容
    const { lastUpdated, ...dataWithoutTimestamp } = data;
    return dataWithoutTimestamp;
  } catch (err) {
    console.warn('讀取現有檔案時發生錯誤，將無視舊資料直接重建:', err.message);
    return null;
  }
}

/**
 * 比較舊資料與新資料是否完全一致
 * @param {Object} oldData - 本地既有資料
 * @param {Object} newData - 剛從試算表抓下來的最新資料
 * @returns {boolean} 資料是否相同
 */
function compareData(oldData, newData) {
  if (!oldData) return false; // 若沒有舊資料，代表一定是新變動
  
  // 將物件轉為字串進行簡單暴力的深度比較 (因為資料結構單純，此方法效能與準確度已足夠)
  return JSON.stringify(oldData) === JSON.stringify(newData);
}

// ============================================================================
// 主程式執行區
// ============================================================================

async function main() {
  console.log('開始執行同步任務：正在讀取試算表資料...');
  
  try {
    // 平行發出三個 HTTP 請求，等待所有工作表都下載完成，提升執行效率
    const [meetings, representatives, assignments] = await Promise.all([
      fetchSheet(SHEETS.meetings.gid),
      fetchSheet(SHEETS.representatives.gid),
      fetchSheet(SHEETS.assignments.gid)
    ]);

    // 將二維陣列 (CSV row) 映射 (map) 為有意義的物件結構 (JSON)
    const newData = {
      // 處理會議基本資料
      meetings: meetings.map(m => ({
      id: m[0],                 // A欄: 流水編號
      name: m[1],               // B欄: 會議名稱
      link: m[2],               // C欄: 會議資料連結
      department: m[3],         // D欄: 承辦單位
      departmentLink: m[4],     // E欄: 承辦單位連結
      totalSeats: m[5],         // F欄: 本會法定可推派總額
      regulationArticle: m[6],  // G欄: 本會推派辦法款次
      seatDistribution: m[7],   // H欄: 席次分配
      sanxiaRegulation: m[8],   // I欄: 三峽規則款次
      sanxiaMethod: m[9],       // J欄: 三峽推派方式
      taipeiRegulation: m[10],  // K欄: 臺北規則款次
      taipeiMethod: m[11],      // L欄: 臺北推派方式
      otherMethod: m[12],       // M欄: 其他推派方式
      note: m[13]               // N欄: 備註
    })).filter(m => m.name),    // 確保B欄(會議名稱)有值才保留
      
      // 處理學代基本資料
      representatives: representatives.map(r => ({
      group: r[0],              // A欄: 分組
      id: r[1],                 // B欄: 流水編號
      name: r[2],               // C欄: 姓名
      title: r[3],              // D欄: 職稱
      department: r[4],         // E欄: 系級
      note: r[5]                // F欄: 備註
    })).filter(r => r.name),    // 確保 C 欄有值 (有姓名) 才保留
      
      // 處理會議與學代的對應名單
      assignments: assignments.map(a => ({
        id: a[0],                 // A欄: 流水編號
        meetingName: a[1],        // B欄: 會議名稱
        representativeName: a[2]  // C欄: 學代姓名
      })).filter(a => a.meetingName && a.representativeName), // 確保 B、C欄都有值
    };

    console.log(`[讀取完成] 會議: ${newData.meetings.length} 筆、學代: ${newData.representatives.length} 筆、推派: ${newData.assignments.length} 筆`);

    // 比對本地端與雲端的資料差異
    const existingData = loadExistingData();
    const isSame = compareData(existingData, newData);

    // 若完全相同，則提早結束程式，避免無意義的 Git Commit
    if (isSame) {
      console.log('✓ 試算表內容無變動，跳過更新');
      console.log('本地檔案時間戳記保持不變');
      process.exit(0);
    }

    // 若有變動，準備寫入新檔案
    console.log('⚠ 偵測到試算表內容變動，準備更新本地檔案...');
    
    // 將新資料組合，並壓上最新的 ISO 格式時間戳記
    const dataWithTimestamp = {
      ...newData,
      lastUpdated: new Date().toISOString()
    };

    // 防呆機制：如果 ./data 目錄不存在，則自動建立 (包含多層級建立)
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      console.log(`已自動建立存放目錄: ${OUTPUT_DIR}`);
    }

    // 將 JSON 格式化 (縮排 2 格) 並寫入檔案
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(dataWithTimestamp, null, 2), 'utf8');
    
    console.log('✓ 資料更新成功！');
    console.log(`更新時間: ${dataWithTimestamp.lastUpdated}`);
    
    process.exit(0); // 正常退出
    
  } catch (err) {
    console.error('❌ 執行過程發生錯誤：', err);
    process.exit(1); // 異常退出，回傳狀態碼 1 給 CI/CD 系統
  }
}

// 執行主程式
main();