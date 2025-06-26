require('dotenv').config();

const { dbConfig, syncConfig, validateConfig } = require('./config/database');
const AdapterFactory = require('./adapters/AdapterFactory');
const SyncJob = require('./core/SyncJob');
const TableAnalyzer = require('./utils/tableAnalyzer');
const DaemonManager = require('./utils/daemon');
const { logger, syncLogger } = require('./utils/logger');

/**
 * 主要的資料庫同步器
 */
class DatabaseSyncer {
  constructor() {
    this.adapters = {};
    this.analyzers = {};
    this.tableSchemas = new Map();
    this.isRunning = false;
    this.syncInterval = null;
    this.daemon = new DaemonManager(syncConfig.daemon.pidFile);
  }

  /**
   * 初始化同步器
   */
  async initialize() {
    logger.info('正在初始化資料庫同步器...');

    try {
      // 驗證配置
      validateConfig();
      
      // 創建資料庫適配器
      await this.createAdapters();
      
      // 分析表格結構
      await this.analyzeTableSchemas();
      
      // 建立日誌目錄
      await this.ensureLogDirectory();
      
      logger.info('資料庫同步器初始化完成');
      return true;
    } catch (error) {
      logger.error('初始化失敗:', error);
      throw error;
    }
  }

  /**
   * 創建資料庫適配器
   */
  async createAdapters() {
    // 客戶端資料庫適配器
    if (dbConfig.client.host) {
      this.adapters.client = AdapterFactory.createAdapter(dbConfig.client.type, dbConfig.client);
      await this.adapters.client.connect();
      this.analyzers.client = new TableAnalyzer(this.adapters.client);
      logger.info(`客戶端 ${dbConfig.client.type.toUpperCase()} 適配器創建成功`);
    }

    // 伺服器端資料庫適配器
    if (dbConfig.server.host) {
      this.adapters.server = AdapterFactory.createAdapter(dbConfig.server.type, dbConfig.server);
      await this.adapters.server.connect();
      this.analyzers.server = new TableAnalyzer(this.adapters.server);
      logger.info(`伺服器端 ${dbConfig.server.type.toUpperCase()} 適配器創建成功`);
    }
  }

  /**
   * 分析表格結構
   */
  async analyzeTableSchemas() {
    logger.info('開始分析表格結構...');
    
    const { clientToServer, serverToClient } = syncConfig.tables;
    const allTables = new Set();
    
    // 收集所有需要分析的表格
    if (clientToServer.listenTable) allTables.add(clientToServer.listenTable);
    if (clientToServer.syncTable) allTables.add(clientToServer.syncTable);
    if (serverToClient.listenTable) allTables.add(serverToClient.listenTable);
    if (serverToClient.syncTable) allTables.add(serverToClient.syncTable);

    for (const tableName of allTables) {
      try {
        // 分析客戶端表格結構
        if (this.analyzers.client && (
          tableName === clientToServer.listenTable || 
          tableName === serverToClient.syncTable
        )) {
          const clientSchema = await this.analyzers.client.analyzeTable(tableName);
          this.tableSchemas.set(`client.${tableName}`, clientSchema);
        }

        // 分析伺服器端表格結構
        if (this.analyzers.server && (
          tableName === serverToClient.listenTable || 
          tableName === clientToServer.syncTable
        )) {
          const serverSchema = await this.analyzers.server.analyzeTable(tableName);
          this.tableSchemas.set(`server.${tableName}`, serverSchema);
        }

      } catch (error) {
        logger.error(`分析表格 ${tableName} 結構失敗:`, error);
        // 繼續處理其他表格
      }
    }

    // 清理過期快取
    if (syncConfig.schemaCache.enabled) {
      try {
        for (const analyzer of Object.values(this.analyzers)) {
          await analyzer.cleanupExpiredCache();
        }
      } catch (error) {
        logger.warn('清理過期快取失敗:', error);
      }
    }

    logger.info(`表格結構分析完成，共分析 ${this.tableSchemas.size} 個表格`);
  }

  /**
   * 建立日誌目錄
   */
  async ensureLogDirectory() {
    const fs = require('fs').promises;
    const path = require('path');
    
    const logDir = path.join(process.cwd(), 'logs');
    try {
      await fs.access(logDir);
    } catch {
      await fs.mkdir(logDir, { recursive: true });
      logger.info('日誌目錄創建成功');
    }
  }

  /**
   * 開始同步作業
   */
  async start(daemonMode = false) {
    if (this.isRunning) {
      logger.warn('同步器已經在運行中');
      return;
    }

    // 處理守護進程模式
    if (daemonMode || syncConfig.daemon.enabled) {
      await this.daemon.startDaemon();
    }

    logger.info('開始資料庫同步作業...');
    this.isRunning = true;

    // 立即執行一次同步
    await this.runSync();

    // 設定定時同步
    this.setupInterval();
  }

  /**
   * 停止同步作業
   */
  async stop() {
    logger.info('停止資料庫同步作業...');
    this.isRunning = false;

    // 停止定時任務
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    // 關閉資料庫連接
    await this.closeConnections();

    logger.info('資料庫同步作業已停止');
  }

  /**
   * 設定定時任務
   */
  setupInterval() {
    this.syncInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.runSync();
      }
    }, syncConfig.interval);

    logger.info(`定時同步任務已設定，間隔: ${syncConfig.interval}ms`);
  }

  /**
   * 執行同步作業
   */
  async runSync() {
    if (!this.isRunning) return;

    const startTime = new Date();
    logger.info('開始執行同步作業');

    try {
      const results = {
        totalTables: 0,
        successTables: 0,
        failedTables: 0,
        totalRecords: 0
      };

      const { clientToServer, serverToClient } = syncConfig.tables;

      // 客戶端 -> 伺服器端同步
      if (this.adapters.client && this.adapters.server && 
          clientToServer.listenTable && clientToServer.syncTable) {
        const clientToServerResults = await this.syncTablePair(
          this.adapters.client,
          this.adapters.server,
          clientToServer.listenTable,
          clientToServer.syncTable,
          '客戶端 -> 伺服器端',
          'client'
        );
        this.mergeResults(results, clientToServerResults);
      }

      // 伺服器端 -> 客戶端同步
      if (this.adapters.server && this.adapters.client && 
          serverToClient.listenTable && serverToClient.syncTable) {
        const serverToClientResults = await this.syncTablePair(
          this.adapters.server,
          this.adapters.client,
          serverToClient.listenTable,
          serverToClient.syncTable,
          '伺服器端 -> 客戶端',
          'server'
        );
        this.mergeResults(results, serverToClientResults);
      }

      const duration = new Date() - startTime;
      logger.info('同步作業完成', {
        duration,
        ...results
      });

    } catch (error) {
      logger.error('同步作業失敗:', error);
    }
  }

  /**
   * 同步單對表格
   */
  async syncTablePair(sourceAdapter, targetAdapter, listenTable, syncTable, direction, schemaPrefix) {
    const results = {
      totalTables: 1,
      successTables: 0,
      failedTables: 0,
      totalRecords: 0
    };

    logger.info(`開始 ${direction} 同步: ${listenTable} -> ${syncTable}`);

    if (!this.isRunning) return results;

    try {
      syncLogger.syncStart(`${listenTable} -> ${syncTable}`, direction.split(' -> ')[0], direction.split(' -> ')[1]);

      // 取得監聽表的結構資訊
      const listenTableSchema = this.tableSchemas.get(`${schemaPrefix}.${listenTable}`);
      
      // 建立同步任務，傳入表格結構資訊
      const syncJobOptions = {
        updateColumn: syncConfig.updateColumn,
        batchSize: syncConfig.batchSize,
        maxRetryAttempts: syncConfig.maxRetryAttempts,
        targetTableName: syncTable // 指定目標表格名稱
      };

      // 如果有表格結構資訊，使用分析結果
      if (listenTableSchema) {
        syncJobOptions.keyColumn = listenTableSchema.primaryKey || 'id';
        syncJobOptions.updateColumn = listenTableSchema.updateColumn || syncConfig.updateColumn;
        syncJobOptions.optimizedQueries = listenTableSchema.optimizedQueries;
      }

      // 建立同步任務：監聽源表，同步到目標表
      const syncJob = new SyncJob(sourceAdapter, targetAdapter, listenTable.trim(), syncJobOptions);
      const result = await syncJob.execute();

      if (result.success) {
        results.successTables++;
        results.totalRecords += result.recordsProcessed;
        syncLogger.syncComplete(`${listenTable} -> ${syncTable}`, result);
      } else {
        results.failedTables++;
        syncLogger.syncError(`${listenTable} -> ${syncTable}`, new Error(result.error));
      }

    } catch (error) {
      results.failedTables++;
      syncLogger.syncError(`${listenTable} -> ${syncTable}`, error);
    }

    return results;
  }

  /**
   * 同步表格（舊版本，保留相容性）
   */
  async syncTables(sourceAdapter, targetAdapter, tables, direction, schemaPrefix) {
    const results = {
      totalTables: tables.length,
      successTables: 0,
      failedTables: 0,
      totalRecords: 0
    };

    logger.info(`開始 ${direction} 同步，表格數量: ${tables.length}`);

    for (const tableName of tables) {
      if (!this.isRunning) break;

      try {
        syncLogger.syncStart(tableName, direction.split(' -> ')[0], direction.split(' -> ')[1]);

        // 取得表格結構資訊
        const tableSchema = this.tableSchemas.get(`${schemaPrefix}.${tableName}`);
        
        // 建立同步任務，傳入表格結構資訊
        const syncJobOptions = {
          updateColumn: syncConfig.updateColumn,
          batchSize: syncConfig.batchSize,
          maxRetryAttempts: syncConfig.maxRetryAttempts
        };

        // 如果有表格結構資訊，使用分析結果
        if (tableSchema) {
          syncJobOptions.keyColumn = tableSchema.primaryKey || 'id';
          syncJobOptions.updateColumn = tableSchema.updateColumn || syncConfig.updateColumn;
          syncJobOptions.optimizedQueries = tableSchema.optimizedQueries;
        }

        const syncJob = new SyncJob(sourceAdapter, targetAdapter, tableName.trim(), syncJobOptions);
        const result = await syncJob.execute();

        if (result.success) {
          results.successTables++;
          results.totalRecords += result.recordsProcessed;
          syncLogger.syncComplete(tableName, result);
        } else {
          results.failedTables++;
          syncLogger.syncError(tableName, new Error(result.error));
        }

      } catch (error) {
        results.failedTables++;
        syncLogger.syncError(tableName, error);
      }
    }

    return results;
  }

  /**
   * 合併同步結果
   */
  mergeResults(target, source) {
    target.totalTables += source.totalTables;
    target.successTables += source.successTables;
    target.failedTables += source.failedTables;
    target.totalRecords += source.totalRecords;
  }

  /**
   * 關閉所有資料庫連接
   */
  async closeConnections() {
    for (const [name, adapter] of Object.entries(this.adapters)) {
      try {
        await adapter.disconnect();
        logger.info(`${name} 連接已關閉`);
      } catch (error) {
        logger.error(`關閉 ${name} 連接失敗:`, error);
      }
    }
    this.adapters = {};
  }

  /**
   * 取得同步器狀態
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      adapters: Object.keys(this.adapters),
      tableSchemas: Array.from(this.tableSchemas.keys()),
      cronJobs: this.cronJobs.length,
      config: {
        interval: syncConfig.interval,
        updateColumn: syncConfig.updateColumn,
        batchSize: syncConfig.batchSize,
        tables: syncConfig.tables,
        daemon: syncConfig.daemon
      }
    };
  }

  /**
   * 重新分析表格結構
   */
  async reanalyzeSchemas() {
    logger.info('重新分析表格結構...');
    
    // 清除快取
    for (const analyzer of Object.values(this.analyzers)) {
      analyzer.clearCache();
    }
    this.tableSchemas.clear();
    
    // 重新分析
    await this.analyzeTableSchemas();
  }
}

/**
 * 命令行介面
 */
async function handleCommand(command, syncer) {
  switch (command) {
    case 'start':
      await syncer.initialize();
      await syncer.start();
      break;
      
    case 'start-daemon':
      await syncer.initialize();
      await syncer.start(true);
      break;
      
    case 'stop':
      const daemon = new DaemonManager(syncConfig.daemon.pidFile);
      await daemon.stopDaemon();
      break;
      
    case 'restart':
      const restartDaemon = new DaemonManager(syncConfig.daemon.pidFile);
      await restartDaemon.restartDaemon();
      break;
      
    case 'status':
      const statusDaemon = new DaemonManager(syncConfig.daemon.pidFile);
      const status = await statusDaemon.getStatus();
      console.log('守護進程狀態:', status);
      break;
      
    default:
      console.log(`
使用方法:
  npm start              - 啟動同步器（前台運行）
  npm run start:daemon   - 啟動守護進程
  npm run stop           - 停止守護進程
  npm run restart        - 重啟守護進程
  npm run status         - 查看狀態
      `);
  }
}

/**
 * 主程式入口
 */
async function main() {
  const syncer = new DatabaseSyncer();
  const command = process.argv[2];

  // 處理命令行參數
  if (command) {
    try {
      await handleCommand(command, syncer);
      return;
    } catch (error) {
      logger.error(`執行命令 ${command} 失敗:`, error);
      process.exit(1);
    }
  }

  // 處理程序終止信號
  process.on('SIGINT', async () => {
    logger.info('收到 SIGINT 信號，正在關閉同步器...');
    await syncer.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('收到 SIGTERM 信號，正在關閉同步器...');
    await syncer.stop();
    process.exit(0);
  });

  process.on('uncaughtException', (error) => {
    logger.error('未捕獲的異常:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('未處理的 Promise 拒絕:', { reason, promise });
    process.exit(1);
  });

  try {
    await syncer.initialize();
    await syncer.start();
    
    logger.info('資料庫同步器啟動成功');
    logger.info('同步器狀態:', syncer.getStatus());
    
  } catch (error) {
    logger.error('啟動同步器失敗:', error);
    process.exit(1);
  }
}

// 如果直接執行此檔案，啟動主程式
if (require.main === module) {
  main();
}

module.exports = DatabaseSyncer; 