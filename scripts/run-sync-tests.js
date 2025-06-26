#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🧪 開始執行雙向同步測試');
console.log('=====================================\n');

// 測試配置
const testConfig = {
  timeout: 120000, // 2分鐘超時
  verbose: true,
  detectOpenHandles: true,
  forceExit: true
};

// 測試執行順序
const testSequence = [
  {
    name: '1. 單元測試 - CRUD 基本功能',
    testFile: 'tests/unit/crud-unit.test.js',
    description: '測試 MariaDB 和 MSSQL 的基本 CRUD 操作'
  },
  {
    name: '2. 整合測試 - 雙向同步功能',
    testFile: 'tests/bidirectional-sync.test.js',
    description: '測試 MariaDB 和 MSSQL 之間的雙向同步'
  }
];

/**
 * 執行單個測試文件
 */
async function runSingleTest(testInfo) {
  console.log(`\n🔧 ${testInfo.name}`);
  console.log(`📄 ${testInfo.description}`);
  console.log(`📂 檔案: ${testInfo.testFile}`);
  console.log('─'.repeat(50));
  
  const startTime = Date.now();
  
  try {
    // 檢查測試文件是否存在
    if (!fs.existsSync(testInfo.testFile)) {
      throw new Error(`測試文件不存在: ${testInfo.testFile}`);
    }
    
    // 建構 Jest 命令
    const jestCommand = [
      'npx jest',
      `"${testInfo.testFile}"`,
      '--verbose',
      '--detectOpenHandles',
      '--forceExit',
      `--testTimeout=${testConfig.timeout}`,
      '--colors',
      '--no-cache'
    ].join(' ');
    
    console.log(`🚀 執行命令: ${jestCommand}\n`);
    
    // 執行測試
    execSync(jestCommand, {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ ${testInfo.name} 完成 (${duration}s)`);
    
    return { success: true, duration, error: null };
    
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`\n❌ ${testInfo.name} 失敗 (${duration}s)`);
    console.error(`錯誤: ${error.message}`);
    
    return { success: false, duration, error: error.message };
  }
}

/**
 * 檢查環境配置
 */
function checkEnvironment() {
  console.log('🔍 檢查環境配置...');
  
  const requiredEnvVars = [
    'CLIENT_DB_HOST',
    'CLIENT_DB_PORT', 
    'CLIENT_DB_USER',
    'CLIENT_DB_PASSWORD',
    'CLIENT_DB_DATABASE',
    'SERVER_DB_HOST',
    'SERVER_DB_PORT',
    'SERVER_DB_USER', 
    'SERVER_DB_PASSWORD',
    'SERVER_DB_DATABASE'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ 缺少必要的環境變數:');
    missingVars.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    console.error('\n請檢查 .env 檔案或環境變數設定');
    process.exit(1);
  }
  
  console.log('✅ 環境配置檢查通過');
  console.log(`   📊 MariaDB: ${process.env.CLIENT_DB_HOST}:${process.env.CLIENT_DB_PORT}`);
  console.log(`   📊 MSSQL: ${process.env.SERVER_DB_HOST}:${process.env.SERVER_DB_PORT}`);
}

/**
 * 檢查資料庫連接
 */
async function checkDatabaseConnections() {
  console.log('\n🔗 檢查資料庫連接...');
  
  try {
    const AdapterFactory = require('../src/adapters/AdapterFactory');
    
    // 測試 MariaDB 連接
    const mariadbAdapter = AdapterFactory.createAdapter('mariadb', {
      type: 'mariadb',
      host: process.env.CLIENT_DB_HOST,
      port: parseInt(process.env.CLIENT_DB_PORT),
      user: process.env.CLIENT_DB_USER,
      password: process.env.CLIENT_DB_PASSWORD,
      database: process.env.CLIENT_DB_DATABASE
    });
    
    await mariadbAdapter.executeQuery('SELECT 1');
    await mariadbAdapter.close();
    console.log('✅ MariaDB 連接成功');
    
    // 測試 MSSQL 連接
    const mssqlAdapter = AdapterFactory.createAdapter('mssql', {
      type: 'mssql',
      server: process.env.SERVER_DB_HOST,
      port: parseInt(process.env.SERVER_DB_PORT),
      user: process.env.SERVER_DB_USER,
      password: process.env.SERVER_DB_PASSWORD,
      database: process.env.SERVER_DB_DATABASE,
      options: {
        encrypt: true,
        trustServerCertificate: true
      }
    });
    
    await mssqlAdapter.executeQuery('SELECT 1');
    await mssqlAdapter.close();
    console.log('✅ MSSQL 連接成功');
    
  } catch (error) {
    console.error('❌ 資料庫連接失敗:', error.message);
    process.exit(1);
  }
}

/**
 * 產生測試報告
 */
function generateTestReport(results) {
  console.log('\n📋 測試執行報告');
  console.log('=====================================');
  
  const totalTests = results.length;
  const passedTests = results.filter(r => r.success).length;
  const failedTests = totalTests - passedTests;
  const totalDuration = results.reduce((sum, r) => sum + parseFloat(r.duration), 0).toFixed(2);
  
  console.log(`📊 總計: ${totalTests} 個測試套件`);
  console.log(`✅ 通過: ${passedTests}`);
  console.log(`❌ 失敗: ${failedTests}`);
  console.log(`⏱️  總耗時: ${totalDuration}s`);
  
  if (failedTests > 0) {
    console.log('\n❌ 失敗的測試:');
    results.filter(r => !r.success).forEach((result, index) => {
      console.log(`   ${index + 1}. ${result.name}: ${result.error}`);
    });
  }
  
  // 產生 JSON 報告
  const reportPath = path.join(process.cwd(), 'test-results.json');
  const reportData = {
    timestamp: new Date().toISOString(),
    summary: {
      total: totalTests,
      passed: passedTests,
      failed: failedTests,
      duration: totalDuration
    },
    results: results
  };
  
  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
  console.log(`\n📄 詳細報告已儲存至: ${reportPath}`);
  
  return failedTests === 0;
}

/**
 * 主執行函數
 */
async function main() {
  try {
    // 環境檢查
    checkEnvironment();
    await checkDatabaseConnections();
    
    console.log('\n🚀 開始執行測試序列');
    console.log('=====================================');
    
    const results = [];
    
    // 依序執行測試
    for (const testInfo of testSequence) {
      const result = await runSingleTest(testInfo);
      results.push({
        name: testInfo.name,
        file: testInfo.testFile,
        ...result
      });
      
      // 如果測試失敗且不是最後一個測試，詢問是否繼續
      if (!result.success && testSequence.indexOf(testInfo) < testSequence.length - 1) {
        console.log('\n⚠️  測試失敗，是否繼續執行後續測試？');
        // 在 CI 環境中自動繼續
        if (!process.env.CI) {
          console.log('按 Ctrl+C 停止，或等待 5 秒自動繼續...');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }
    
    // 產生報告
    const allPassed = generateTestReport(results);
    
    if (allPassed) {
      console.log('\n🎉 所有測試通過！');
      process.exit(0);
    } else {
      console.log('\n💥 部分測試失敗');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n💥 測試執行過程中發生錯誤:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 處理 Ctrl+C 中斷
process.on('SIGINT', () => {
  console.log('\n\n⚠️  收到中斷信號，正在清理...');
  process.exit(130);
});

// 執行主函數
main(); 