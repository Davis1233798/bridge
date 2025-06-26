#!/usr/bin/env node
/**
 * 測試執行腳本
 * 提供互動式測試選項
 */

const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const testOptions = {
  '1': {
    name: '執行 CRUD 操作測試 (雙資料庫)',
    command: 'npm run test:crud'
  },
  '2': {
    name: '執行 MSSQL CRUD 測試 (僅客戶端)',
    command: 'npm run test:mssql'
  },
  '3': {
    name: '執行 Jest 單元測試',
    command: 'npm test'
  },
  '4': {
    name: '執行測試覆蓋率分析',
    command: 'npm run test:coverage'
  },
  '5': {
    name: '執行監控模式測試',
    command: 'npm run test:watch'
  },
  '6': {
    name: '執行所有測試',
    command: 'npm run test:mssql && npm run test:coverage'
  }
};

function showMenu() {
  console.log('\n🧪 資料庫同步器測試選項:\n');
  
  Object.entries(testOptions).forEach(([key, option]) => {
    console.log(`${key}. ${option.name}`);
  });
  
  console.log('0. 退出\n');
}

function executeTest(option) {
  if (!option) {
    console.log('❌ 無效的選項');
    return;
  }
  
  console.log(`\n🚀 執行: ${option.name}\n`);
  
  try {
    execSync(option.command, { stdio: 'inherit' });
    console.log('\n✅ 測試完成');
  } catch (error) {
    console.error('\n❌ 測試失敗:', error.message);
  }
}

function main() {
  console.log('🔧 資料庫同步器測試工具');
  console.log('================================');
  
  showMenu();
  
  rl.question('請選擇測試選項 (0-6): ', (answer) => {
    const choice = answer.trim();
    
    if (choice === '0') {
      console.log('👋 再見！');
      rl.close();
      return;
    }
    
    const option = testOptions[choice];
    executeTest(option);
    
    // 詢問是否繼續
    rl.question('\n是否繼續測試？(y/n): ', (continueAnswer) => {
      if (continueAnswer.toLowerCase() === 'y' || continueAnswer.toLowerCase() === 'yes') {
        main();
      } else {
        console.log('👋 再見！');
        rl.close();
      }
    });
  });
}

if (require.main === module) {
  main();
} 