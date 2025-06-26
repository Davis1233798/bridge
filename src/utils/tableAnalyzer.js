const { logger } = require('./logger');
const fs = require('fs').promises;
const path = require('path');
const { syncConfig } = require('../config/database');

/**
 * 表結構分析器
 * 分析表格結構，取得主鍵、索引等資訊等，並支援檔案快取
 */
class TableAnalyzer {
  constructor(adapter) {
    this.adapter = adapter;
    this.cache = new Map(); // 記憶體快取表結構資訊
    this.cacheFile = syncConfig.schemaCache.filePath;
    this.cacheTTL = syncConfig.schemaCache.ttl;
    this.cacheEnabled = syncConfig.schemaCache.enabled;
  }

  /**
   * 分析表格結構
   * @param {string} tableName - 表格名稱
   * @returns {Object} 表格結構資訊
   */
  async analyzeTable(tableName) {
    // 檢查記憶體快取
    if (this.cache.has(tableName)) {
      return this.cache.get(tableName);
    }

    // 檢查檔案快取
    if (this.cacheEnabled) {
      const cachedData = await this.loadFromFileCache(tableName);
      if (cachedData) {
        this.cache.set(tableName, cachedData);
        return cachedData;
      }
    }

    logger.info(`開始分析表格結構: ${tableName}`);

    try {
      const tableInfo = {
        tableName,
        primaryKey: null,
        columns: [],
        indexes: [],
        updateColumn: null,
        optimizedQueries: {},
        analyzedAt: new Date().toISOString(),
        dbType: this.adapter.config.type
      };

      // 取得表格結構資訊
      const dbType = this.adapter.config.type || 'mariadb';
      
      switch (dbType) {
        case 'mssql':
          await this.analyzeMSSQLTable(tableName, tableInfo);
          break;
        case 'mariadb':
        case 'mysql':
          await this.analyzeMariaDBTable(tableName, tableInfo);
          break;
        case 'postgres':
        case 'postgresql':
          await this.analyzePostgreSQLTable(tableName, tableInfo);
          break;
        default:
          await this.analyzeGenericTable(tableName, tableInfo);
      }

      // 生成優化查詢
      this.generateOptimizedQueries(tableInfo);

      // 快取結果到記憶體
      this.cache.set(tableName, tableInfo);
      
      // 快取結果到檔案
      if (this.cacheEnabled) {
        await this.saveToFileCache(tableName, tableInfo);
      }
      
      logger.info(`表格 ${tableName} 結構分析完成`, {
        primaryKey: tableInfo.primaryKey,
        columnCount: tableInfo.columns.length,
        indexCount: tableInfo.indexes.length,
        updateColumn: tableInfo.updateColumn,
        cached: this.cacheEnabled
      });

      return tableInfo;

    } catch (error) {
      logger.error(`表格 ${tableName} 結構分析失敗:`, error);
      throw error;
    }
  }

  /**
   * 分析 MSSQL 表格結構
   */
  async analyzeMSSQLTable(tableName, tableInfo) {
    // 取得欄位資訊
    const columnQuery = `
      SELECT 
        c.COLUMN_NAME,
        c.DATA_TYPE,
        c.IS_NULLABLE,
        c.COLUMN_DEFAULT,
        kc.CONSTRAINT_NAME as PK_CONSTRAINT
      FROM INFORMATION_SCHEMA.COLUMNS c
      LEFT JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kc 
        ON c.TABLE_NAME = kc.TABLE_NAME 
        AND c.COLUMN_NAME = kc.COLUMN_NAME
        AND kc.CONSTRAINT_NAME LIKE 'PK_%'
      WHERE c.TABLE_NAME = '${tableName}'
      ORDER BY c.ORDINAL_POSITION
    `;

    const columns = await this.adapter.query(columnQuery);
    tableInfo.columns = columns;

    // 找出主鍵
    const pkColumn = columns.find(col => col.PK_CONSTRAINT);
    if (pkColumn) {
      tableInfo.primaryKey = pkColumn.COLUMN_NAME;
    }

    // 找出更新時間欄位
    const updateColumns = ['updated_at', 'last_update', 'modify_time', 'update_time'];
    for (const updateCol of updateColumns) {
      if (columns.some(col => col.COLUMN_NAME.toLowerCase() === updateCol)) {
        tableInfo.updateColumn = updateCol;
        break;
      }
    }

    // 取得索引資訊
    const indexQuery = `
      SELECT 
        i.name as INDEX_NAME,
        c.name as COLUMN_NAME,
        i.is_unique
      FROM sys.indexes i
      INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      WHERE i.object_id = OBJECT_ID('${tableName}')
      ORDER BY i.name, ic.key_ordinal
    `;

    const indexes = await this.adapter.query(indexQuery);
    tableInfo.indexes = indexes;
  }

  /**
   * 分析 MariaDB/MySQL 表格結構
   */
  async analyzeMariaDBTable(tableName, tableInfo) {
    // 取得欄位資訊
    const columnQuery = `
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        COLUMN_DEFAULT,
        COLUMN_KEY
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = '${tableName}'
      ORDER BY ORDINAL_POSITION
    `;

    const columns = await this.adapter.query(columnQuery);
    tableInfo.columns = columns;

    // 找出主鍵
    const pkColumn = columns.find(col => col.COLUMN_KEY === 'PRI');
    if (pkColumn) {
      tableInfo.primaryKey = pkColumn.COLUMN_NAME;
    }

    // 找出更新時間欄位
    const updateColumns = ['updated_at', 'last_update', 'modify_time', 'update_time'];
    for (const updateCol of updateColumns) {
      if (columns.some(col => col.COLUMN_NAME.toLowerCase() === updateCol.toLowerCase())) {
        tableInfo.updateColumn = columns.find(col => 
          col.COLUMN_NAME.toLowerCase() === updateCol.toLowerCase()
        ).COLUMN_NAME;
        break;
      }
    }

    // 取得索引資訊
    const indexQuery = `
      SELECT 
        INDEX_NAME,
        COLUMN_NAME,
        NON_UNIQUE
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = '${tableName}'
      ORDER BY INDEX_NAME, SEQ_IN_INDEX
    `;

    const indexes = await this.adapter.query(indexQuery);
    tableInfo.indexes = indexes;
  }

  /**
   * 分析 PostgreSQL 表格結構
   */
  async analyzePostgreSQLTable(tableName, tableInfo) {
    // PostgreSQL 結構分析（預留）
    logger.warn(`PostgreSQL 表結構分析尚未實作: ${tableName}`);
    await this.analyzeGenericTable(tableName, tableInfo);
  }

  /**
   * 通用表格結構分析（備用方案）
   */
  async analyzeGenericTable(tableName, tableInfo) {
    try {
      // 嘗試查詢表格以獲取基本欄位資訊
      const sampleQuery = `SELECT * FROM \`${tableName}\` LIMIT 1`;
      const result = await this.adapter.query(sampleQuery);
      
      if (result && result.length > 0) {
        const columns = Object.keys(result[0]).map(columnName => ({
          COLUMN_NAME: columnName,
          DATA_TYPE: 'unknown',
          IS_NULLABLE: 'YES'
        }));
        tableInfo.columns = columns;

        // 嘗試猜測主鍵
        const possiblePkColumns = ['id', 'ID', 'Id'];
        for (const pkCol of possiblePkColumns) {
          if (columns.some(col => col.COLUMN_NAME === pkCol)) {
            tableInfo.primaryKey = pkCol;
            break;
          }
        }

        // 嘗試猜測更新時間欄位
        const updateColumns = ['updated_at', 'last_update', 'modify_time', 'update_time'];
        for (const updateCol of updateColumns) {
          if (columns.some(col => col.COLUMN_NAME.toLowerCase() === updateCol)) {
            tableInfo.updateColumn = updateCol;
            break;
          }
        }
      }
    } catch (error) {
      logger.warn(`通用表結構分析失敗: ${tableName}`, error);
    }
  }

  /**
   * 生成優化查詢語句
   */
  generateOptimizedQueries(tableInfo) {
    const { tableName, primaryKey, updateColumn } = tableInfo;
    
    // 根據資料庫類型選擇引號符號
    const quote = this.getQuoteChar();
    const quotedTable = `${quote}${tableName}${quote}`;
    const quotedPk = primaryKey ? `${quote}${primaryKey}${quote}` : 'id';
    const quotedUpdate = updateColumn ? `${quote}${updateColumn}${quote}` : `${quote}updated_at${quote}`;

    tableInfo.optimizedQueries = {
      // 檢查記錄是否存在
      checkExists: `SELECT COUNT(*) as count FROM ${quotedTable} WHERE ${quotedPk} = ?`,
      
      // 取得最後更新時間
      getLastUpdate: `SELECT MAX(${quotedUpdate}) as lastUpdate FROM ${quotedTable}`,
      
      // 取得更新的記錄（有索引優化）
      getUpdatedRecords: updateColumn 
        ? `SELECT * FROM ${quotedTable} WHERE ${quotedUpdate} > ? ORDER BY ${quotedUpdate}` 
        : `SELECT * FROM ${quotedTable}`,
        
      // 批次插入準備語句
      batchInsertTemplate: this.generateInsertTemplate(tableInfo),
      
      // 批次更新準備語句
      batchUpdateTemplate: this.generateUpdateTemplate(tableInfo)
    };
  }

  /**
   * 取得資料庫引號字元
   */
  getQuoteChar() {
    const dbType = this.adapter.config.type || 'mariadb';
    switch (dbType) {
      case 'mssql':
        return '[';
      case 'mariadb':
      case 'mysql':
        return '`';
      case 'postgres':
      case 'postgresql':
        return '"';
      default:
        return '`';
    }
  }

  /**
   * 生成插入語句範本
   */
  generateInsertTemplate(tableInfo) {
    const quote = this.getQuoteChar();
    const closeQuote = quote === '[' ? ']' : quote;
    const quotedTable = `${quote}${tableInfo.tableName}${closeQuote}`;
    
    return {
      table: quotedTable,
      columns: tableInfo.columns.map(col => `${quote}${col.COLUMN_NAME}${closeQuote}`)
    };
  }

  /**
   * 生成更新語句範本
   */
  generateUpdateTemplate(tableInfo) {
    const quote = this.getQuoteChar();
    const closeQuote = quote === '[' ? ']' : quote;
    const quotedTable = `${quote}${tableInfo.tableName}${closeQuote}`;
    const quotedPk = `${quote}${tableInfo.primaryKey || 'id'}${closeQuote}`;
    
    return {
      table: quotedTable,
      primaryKey: quotedPk,
      columns: tableInfo.columns
        .filter(col => col.COLUMN_NAME !== tableInfo.primaryKey)
        .map(col => `${quote}${col.COLUMN_NAME}${closeQuote}`)
    };
  }

  /**
   * 清除快取
   */
  clearCache() {
    this.cache.clear();
    logger.info('表結構快取已清除');
  }

  /**
   * 取得快取資訊
   */
  getCacheInfo() {
    return {
      cachedTables: Array.from(this.cache.keys()),
      cacheSize: this.cache.size,
      cacheFile: this.cacheFile,
      cacheEnabled: this.cacheEnabled,
      cacheTTL: this.cacheTTL
    };
  }

  /**
   * 從檔案快取載入表結構
   * @param {string} tableName - 表格名稱
   * @returns {Object|null} 表格結構資訊或 null
   */
  async loadFromFileCache(tableName) {
    try {
      // 檢查快取檔案是否存在
      await fs.access(this.cacheFile);
      
      // 讀取快取檔案
      const cacheData = await fs.readFile(this.cacheFile, 'utf8');
      const cache = JSON.parse(cacheData);
      
      const cacheKey = this.getCacheKey(tableName);
      const cachedItem = cache[cacheKey];
      
      if (!cachedItem) {
        return null;
      }
      
      // 檢查快取是否過期
      const now = Date.now();
      const cacheTime = new Date(cachedItem.cachedAt).getTime();
      const isExpired = (now - cacheTime) > this.cacheTTL;
      
      if (isExpired) {
        logger.debug(`表格 ${tableName} 快取已過期`);
        return null;
      }
      
      logger.debug(`從檔案快取載入表格 ${tableName} 結構`);
      return cachedItem.data;
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        // 檔案不存在，正常情況
        return null;
      }
      logger.warn(`載入檔案快取失敗: ${error.message}`);
      return null;
    }
  }

  /**
   * 儲存表結構到檔案快取
   * @param {string} tableName - 表格名稱
   * @param {Object} tableInfo - 表格結構資訊
   */
  async saveToFileCache(tableName, tableInfo) {
    try {
      // 確保快取目錄存在
      const cacheDir = path.dirname(this.cacheFile);
      await fs.mkdir(cacheDir, { recursive: true });
      
      // 讀取現有快取（如果存在）
      let cache = {};
      try {
        const cacheData = await fs.readFile(this.cacheFile, 'utf8');
        cache = JSON.parse(cacheData);
      } catch (error) {
        // 檔案不存在或損壞，使用空快取
        cache = {};
      }
      
      // 更新快取
      const cacheKey = this.getCacheKey(tableName);
      cache[cacheKey] = {
        data: tableInfo,
        cachedAt: new Date().toISOString()
      };
      
      // 寫入檔案
      await fs.writeFile(this.cacheFile, JSON.stringify(cache, null, 2), 'utf8');
      logger.debug(`表格 ${tableName} 結構已快取到檔案`);
      
    } catch (error) {
      logger.warn(`儲存檔案快取失敗: ${error.message}`);
    }
  }

  /**
   * 生成快取鍵值
   * @param {string} tableName - 表格名稱
   * @returns {string} 快取鍵值
   */
  getCacheKey(tableName) {
    const dbType = this.adapter.config.type || 'unknown';
    const dbHost = this.adapter.config.host || 'localhost';
    const dbName = this.adapter.config.database || 'default';
    return `${dbType}_${dbHost}_${dbName}_${tableName}`;
  }

  /**
   * 清除檔案快取
   */
  async clearFileCache() {
    try {
      await fs.unlink(this.cacheFile);
      logger.info('檔案快取已清除');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.warn(`清除檔案快取失敗: ${error.message}`);
      }
    }
  }

  /**
   * 清除過期的檔案快取項目
   */
  async cleanupExpiredCache() {
    try {
      const cacheData = await fs.readFile(this.cacheFile, 'utf8');
      const cache = JSON.parse(cacheData);
      
      const now = Date.now();
      let cleanedCount = 0;
      
      // 移除過期項目
      for (const [key, item] of Object.entries(cache)) {
        const cacheTime = new Date(item.cachedAt).getTime();
        const isExpired = (now - cacheTime) > this.cacheTTL;
        
        if (isExpired) {
          delete cache[key];
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        await fs.writeFile(this.cacheFile, JSON.stringify(cache, null, 2), 'utf8');
        logger.info(`清理了 ${cleanedCount} 個過期快取項目`);
      }
      
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.warn(`清理過期快取失敗: ${error.message}`);
      }
    }
  }
}

module.exports = TableAnalyzer; 