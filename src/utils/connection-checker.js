const { dbConfig } = require('../config/database');
const AdapterFactory = require('../adapters/AdapterFactory');
const { logger } = require('./logger');

/**
 * 資料庫連線檢查器
 */
class ConnectionChecker {
  constructor() {
    this.adapters = {};
  }

  /**
   * 檢查所有資料庫連線狀態
   */
  async checkAllConnections() {
    const results = {
      client: await this.checkConnection('client', dbConfig.client),
      server: await this.checkConnection('server', dbConfig.server)
    };

    return results;
  }

  /**
   * 檢查單一資料庫連線
   */
  async checkConnection(name, config) {
    const result = {
      name,
      type: config.type,
      host: config.host,
      database: config.database,
      connected: false,
      error: null,
      timestamp: new Date().toISOString(),
      duration: 0
    };

    const startTime = Date.now();

    try {
      logger.info(`開始檢查 ${name} 資料庫連線...`, {
        type: config.type,
        host: config.host,
        database: config.database
      });

      // 創建適配器
      const adapter = AdapterFactory.createAdapter(config.type, config);
      
      // 嘗試連線
      await adapter.connect();
      
      // 測試簡單查詢
      if (config.type.toLowerCase() === 'mssql') {
        await adapter.query('SELECT 1 as test');
      } else {
        await adapter.query('SELECT 1');
      }
      
      result.connected = true;
      result.duration = Date.now() - startTime;
      logger.info(`${name} 資料庫連線正常`, { ...result, duration: `${result.duration}ms` });
      
      // 關閉測試連線
      await adapter.disconnect();
      
    } catch (error) {
      result.error = error.message;
      result.duration = Date.now() - startTime;
      logger.error(`${name} 資料庫連線失敗`, { 
        ...result, 
        error: error.message,
        duration: `${result.duration}ms`
      });
    }

    return result;
  }

  /**
   * 監控連線狀態
   */
  async monitorConnections(interval = 30000) {
    logger.info(`開始監控資料庫連線，檢查間隔: ${interval}ms`);
    
    const monitor = async () => {
      const results = await this.checkAllConnections();
      
      // 記錄連線狀態摘要
      const summary = {
        client: results.client.connected ? '✓' : '✗',
        server: results.server.connected ? '✓' : '✗',
        timestamp: new Date().toISOString()
      };
      
      logger.info('資料庫連線狀態檢查', summary);
      
      return results;
    };

    // 立即檢查一次
    await monitor();
    
    // 設定定時檢查
    return setInterval(monitor, interval);
  }
}

module.exports = ConnectionChecker; 