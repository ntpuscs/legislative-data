import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

/**
 * 解析 .md 檔案中的 YAML front matter
 * @param {string} filePath
 * @returns {object|null}
 */
function parseFrontMatter(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = matter(content);

    if (!parsed.data || !parsed.data.titleShort) {
      console.warn(`檔案 ${filePath} 缺少 titleShort 欄位`);
      return null;
    }

    return parsed.data;
  } catch (error) {
    console.error(`解析檔案 ${filePath} 時發生錯誤:`, error.message);
    return null;
  }
}

/**
 * 掃描 data/bylaws 目錄，取得所有法規資訊
 * @returns {Array} - [[id, titleShort], ...]
 */
function scanRegulations() {
  const regulationsDir = path.join(process.cwd(), 'data', 'bylaws');
  const lawList = [];

  if (!fs.existsSync(regulationsDir)) {
    console.error('data/bylaws 目錄不存在');
    return lawList;
  }

  try {
    const files = fs.readdirSync(regulationsDir);

    const mdFiles = files.filter(file =>
      file.endsWith('.md') && /^\d{4}\.md$/.test(file)
    );

    for (const file of mdFiles) {
      const filePath = path.join(regulationsDir, file);
      const lawId = parseInt(file.replace('.md', ''), 10);

      const frontMatter = parseFrontMatter(filePath);
      if (frontMatter && frontMatter.titleShort) {
        lawList.push([lawId, frontMatter.titleShort]);
      } else {
        console.warn(`檔案 ${file} 缺少 titleShort 欄位`);
      }
    }

    lawList.sort((a, b) => a[0] - b[0]);
    return lawList;
  } catch (error) {
    console.error('掃描法規目錄時發生錯誤:', error.message);
    return lawList;
  }
}

/**
 * 將法規列表寫入 data/bylaw-list.json
 * @param {Array} lawList
 * @returns {boolean}
 */
function writeJsonList(lawList) {
  const outputPath = path.join(process.cwd(), 'data', 'bylaw-list.json');

  try {
    fs.writeFileSync(outputPath, JSON.stringify(lawList, null, 2), 'utf8');
    console.log('✅ 成功寫入 data/bylaw-list.json');
    return true;
  } catch (error) {
    console.error('寫入 JSON 時發生錯誤:', error.message);
    return false;
  }
}

function main() {
  console.log('🔍 開始掃描法規檔案...');

  const lawList = scanRegulations();

  console.log(`📊 找到 ${lawList.length} 個法規檔案:`);
  lawList.forEach(law => {
    console.log(`   - ID: ${law[0]}, 簡稱: ${law[1]}`);
  });

  if (lawList.length > 0) {
    console.log('📝 更新法規列表 JSON...');
    const success = writeJsonList(lawList);

    if (success) {
      console.log('✨ 法規列表更新完成！');
      process.exit(0);
    } else {
      console.log('❌ 法規列表更新失敗！');
      process.exit(1);
    }
  } else {
    console.log('⚠️ 沒有找到有效的法規檔案');
    process.exit(1);
  }
}

main();

export { parseFrontMatter, scanRegulations, writeJsonList, main };