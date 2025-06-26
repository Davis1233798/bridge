#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * 複製 .env.example 到 .env
 */
function setupEnvFile() {
  const envExamplePath = path.join(process.cwd(), '.env.example');
  const envPath = path.join(process.cwd(), '.env');

  if (!fs.existsSync(envExamplePath)) {
    console.log('❌ .env.example 檔案不存在');
    process.exit(1);
  }

  if (fs.existsSync(envPath)) {
    console.log('⚠️  .env 檔案已存在，跳過複製');
    return false;
  }

  try {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('✅ 已建立 .env 檔案');
    return true;
  } catch (error) {
    console.error('❌ 建立 .env 檔案失敗:', error.message);
    process.exit(1);
  }
}

/**
 * 安裝基礎依賴
 */
function installBaseDependencies() {
  console.log('📦 安裝基礎依賴套件...');
  
  try {
    execSync('npm install dotenv winston', { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    console.log('✅ 基礎依賴套件安裝完成');
  } catch (error) {
    console.error('❌ 基礎依賴套件安裝失敗:', error.message);
    process.exit(1);
  }
}

/**
 * 建立必要目錄
 */
function createDirectories() {
  const directories = [
    'cache',
    'logs'
  ];

  for (const dir of directories) {
    const dirPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(dirPath)) {
      try {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`✅ 建立目錄: ${dir}`);
      } catch (error) {
        console.error(`❌ 建立目錄 ${dir} 失敗:`, error.message);
      }
    } else {
      console.log(`📁 目錄已存在: ${dir}`);
    }
  }
}

/**
 * 顯示後續步驟
 */
function showNextSteps(envCreated) {
  console.log('\n🎉 初始設定完成！\n');
  
  if (envCreated) {
    console.log('📝 後續步驟:');
    console.log('1. 編輯 .env 檔案，設定資料庫連線資訊');
    console.log('2. 執行 npm run install-drivers 安裝資料庫驅動程式');
    console.log('3. 執行 npm run check-drivers 檢查驅動程式狀態');
    console.log('4. 執行 npm start 啟動同步器\n');
  } else {
    console.log('📝 後續步驟:');
    console.log('1. 檢查 .env 檔案設定');
    console.log('2. 執行 npm run install-drivers 安裝資料庫驅動程式');
    console.log('3. 執行 npm start 啟動同步器\n');
  }

  console.log('🔧 其他指令:');
  console.log('• npm run start:daemon  - 背景執行');
  console.log('• npm run status        - 檢查執行狀態');
  console.log('• npm run stop          - 停止背景執行');
  console.log('• npm run dev           - 開發模式');
}

/**
 * 主要執行函數
 */
function main() {
  console.log('🚀 開始初始化資料庫同步器...\n');

  // 1. 設定環境檔案
  const envCreated = setupEnvFile();

  // 2. 安裝基礎依賴
  installBaseDependencies();

  // 3. 建立必要目錄
  createDirectories();

  // 4. 顯示後續步驟
  showNextSteps(envCreated);
}

// 執行主函數
if (require.main === module) {
  main();
} 