#!/usr/bin/env node

require('dotenv').config();
const ConnectionChecker = require('../src/utils/connection-checker');

/**
 * 檢查資料庫連線狀態的 CLI 工具
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'check';

  const checker = new ConnectionChecker();

  try {
    switch (command) {
      case 'check':
        console.log('正在檢查資料庫連線狀態...\n');
        const results = await checker.checkAllConnections();
        
        console.log('=== 資料庫連線狀態報告 ===');
        console.log(`檢查時間: ${new Date().toLocaleString()}\n`);
        
        ['client', 'server'].forEach(name => {
          const result = results[name];
          const status = result.connected ? '✅ 連線正常' : '❌ 連線失敗';
          
          console.log(`${name.toUpperCase()} 資料庫:`);
          console.log(`  狀態: ${status}`);
          console.log(`  類型: ${result.type}`);
          console.log(`  主機: ${result.host}`);
          console.log(`  資料庫: ${result.database}`);
          
          if (result.error) {
            console.log(`  錯誤: ${result.error}`);
          }
          console.log();
        });
        
        // 回傳適當的退出碼
        const allConnected = Object.values(results).every(r => r.connected);
        process.exit(allConnected ? 0 : 1);
        break;

      case 'monitor':
        console.log('開始監控資料庫連線狀態...');
        console.log('按 Ctrl+C 停止監控\n');
        
        const interval = parseInt(args[1]) || 30000;
        const monitorInterval = await checker.monitorConnections(interval);
        
        // 監聽退出信號
        process.on('SIGINT', () => {
          console.log('\n正在停止監控...');
          clearInterval(monitorInterval);
          process.exit(0);
        });
        
        // 保持程序運行
        while (true) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        break;

      case 'help':
      default:
        console.log('資料庫連線檢查工具\n');
        console.log('用法:');
        console.log('  node scripts/check-connection.js [命令] [選項]\n');
        console.log('命令:');
        console.log('  check     檢查資料庫連線狀態 (預設)');
        console.log('  monitor   持續監控資料庫連線狀態');
        console.log('            可選參數: 間隔時間(毫秒，預設30000)');
        console.log('  help      顯示此說明\n');
        console.log('範例:');
        console.log('  node scripts/check-connection.js check');
        console.log('  node scripts/check-connection.js monitor 60000');
        break;
    }
  } catch (error) {
    console.error('執行錯誤:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
} 