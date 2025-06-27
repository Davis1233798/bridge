#!/usr/bin/env node

require('dotenv').config();
const { connectionLogger } = require('../src/utils/logger');
const MSSQLAdapter = require('../src/adapters/MSSQLAdapter');

/**
 * Named Pipe 連線測試腳本
 */
class NamedPipeTest {
  constructor() {
    this.testConfigs = this.generateTestConfigs();
  }

  /**
   * 產生測試配置
   */
  generateTestConfigs() {
    const baseConfig = {
      type: 'mssql',
      user: process.env.CLIENT_DB_USER,
      password: process.env.CLIENT_DB_PASSWORD,
      database: process.env.CLIENT_DB_DATABASE
    };

    return [
      {
        name: 'TCP/IP 連線',
        config: {
          ...baseConfig,
          connectionType: 'tcp',
          server: process.env.CLIENT_DB_HOST,
          port: parseInt(process.env.CLIENT_DB_PORT),
          options: {
            encrypt: process.env.CLIENT_DB_ENCRYPT === 'true',
            trustServerCertificate: process.env.CLIENT_DB_TRUST_SERVER_CERTIFICATE === 'true'
          }
        }
      },
      {
        name: 'Named Pipe 連線 (本機預設實例)',
        config: {
          ...baseConfig,
          connectionType: 'namedpipe',
          server: '\\\\.\\pipe\\sql\\query',
          options: {
            useNamedPipes: true,
            encrypt: false,
            trustServerCertificate: true
          }
        }
      },
      {
        name: 'Named Pipe 連線 (自訂路徑)',
        config: {
          ...baseConfig,
          connectionType: 'namedpipe',
          server: process.env.CLIENT_DB_NAMED_PIPE_PATH || '\\\\.\\pipe\\sql\\query',
          options: {
            useNamedPipes: true,
            encrypt: false,
            trustServerCertificate: true
          }
        }
      }
    ];
  }

  /**
   * 測試單一配置
   */
  async testConnection(testConfig) {
    console.log(`\n=== 測試 ${testConfig.name} ===`);
    console.log(`配置: ${JSON.stringify(testConfig.config, null, 2)}`);
    
    const adapter = new MSSQLAdapter(testConfig.config);
    const startTime = Date.now();
    
    try {
      await adapter.connect();
      
      // 執行簡單查詢測試
      const result = await adapter.query('SELECT @@VERSION as version, GETDATE() as current_time');
      const duration = Date.now() - startTime;
      
      console.log(`✅ 連線成功 (${duration}ms)`);
      console.log(`SQL Server 版本: ${result[0].version.split('\n')[0]}`);
      console.log(`伺服器時間: ${result[0].current_time}`);
      
      await adapter.disconnect();
      
      return {
        success: true,
        duration,
        version: result[0].version.split('\n')[0],
        error: null
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`❌ 連線失敗 (${duration}ms)`);
      console.log(`錯誤: ${error.message}`);
      
      // 清理
      try {
        if (adapter.pool) {
          await adapter.disconnect();
        }
      } catch (cleanupError) {
        // 忽略清理錯誤
      }
      
      return {
        success: false,
        duration,
        version: null,
        error: error.message
      };
    }
  }

  /**
   * 執行所有測試
   */
  async runAllTests() {
    console.log('🚀 開始 MSSQL 連線方式測試...\n');
    
    const results = [];
    
    for (const testConfig of this.testConfigs) {
      const result = await this.testConnection(testConfig);
      results.push({
        name: testConfig.name,
        ...result
      });
      
      // 等待一下再進行下一個測試
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // 輸出總結
    this.printSummary(results);
    
    return results;
  }

  /**
   * 輸出測試總結
   */
  printSummary(results) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 測試總結');
    console.log('='.repeat(60));
    
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      const duration = result.duration ? `(${result.duration}ms)` : '';
      
      console.log(`${status} ${result.name} ${duration}`);
      
      if (result.error) {
        console.log(`   錯誤: ${result.error}`);
      }
    });
    
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    
    console.log(`\n總計: ${successCount}/${totalCount} 成功`);
    
    // 性能比較
    const successResults = results.filter(r => r.success);
    if (successResults.length > 1) {
      console.log('\n🏁 性能比較:');
      successResults
        .sort((a, b) => a.duration - b.duration)
        .forEach((result, index) => {
          const rank = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
          console.log(`${rank} ${result.name}: ${result.duration}ms`);
        });
    }
  }

  /**
   * 檢查環境配置
   */
  checkEnvironment() {
    const required = [
      'CLIENT_DB_USER',
      'CLIENT_DB_PASSWORD', 
      'CLIENT_DB_DATABASE'
    ];
    
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      console.error('❌ 缺少必要的環境變數:');
      missing.forEach(key => console.error(`   - ${key}`));
      return false;
    }
    
    if (!process.env.CLIENT_DB_HOST && !process.env.CLIENT_DB_NAMED_PIPE_PATH) {
      console.error('❌ 需要設定 CLIENT_DB_HOST 或 CLIENT_DB_NAMED_PIPE_PATH');
      return false;
    }
    
    return true;
  }
}

/**
 * 主函式
 */
async function main() {
  const tester = new NamedPipeTest();
  
  // 檢查環境配置
  if (!tester.checkEnvironment()) {
    process.exit(1);
  }
  
  try {
    const results = await tester.runAllTests();
    
    // 回傳適當的退出碼
    const hasSuccess = results.some(r => r.success);
    process.exit(hasSuccess ? 0 : 1);
    
  } catch (error) {
    console.error('❌ 測試執行失敗:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = NamedPipeTest; 