const { syncConfig } = require('../config/database');

/**
 * 同步任務類別
 * 處理兩個資料庫之間單個表格的資料同步
 */
class SyncJob {
  constructor(sourceAdapter, targetAdapter, tableName, options = {}) {
    this.sourceAdapter = sourceAdapter;
    this.targetAdapter = targetAdapter;
    this.tableName = tableName; // 來源表名
    this.targetTableName = options.targetTableName || tableName; // 目標表名（可以不同）
    this.updateColumn = options.updateColumn || syncConfig.updateColumn;
    this.keyColumn = options.keyColumn || 'id';
    this.batchSize = options.batchSize || syncConfig.batchSize;
    this.maxRetryAttempts = options.maxRetryAttempts || syncConfig.maxRetryAttempts;
    this.optimizedQueries = options.optimizedQueries || {};
  }

  /**
   * 執行同步作業
   */
  async execute() {
    const startTime = new Date();
    console.log(`開始同步表格 ${this.tableName} (${startTime.toISOString()})`);

    try {
      // 取得上次同步時間（使用目標表名作為同步狀態識別）
      const syncStatusKey = `${this.tableName}_to_${this.targetTableName}`;
      const lastSyncTime = await this.targetAdapter.getSyncStatus(syncStatusKey);
      console.log(`上次同步時間: ${lastSyncTime.toISOString()}`);

      // 從來源資料庫取得更新的記錄
      const updatedRecords = await this.sourceAdapter.getUpdatedRecords(
        this.tableName,
        this.updateColumn,
        lastSyncTime
      );

      if (updatedRecords.length === 0) {
        console.log(`表格 ${this.tableName} -> ${this.targetTableName} 沒有新的更新記錄`);
        return { success: true, recordsProcessed: 0, message: '沒有新記錄' };
      }

      console.log(`找到 ${updatedRecords.length} 筆更新記錄，從 ${this.tableName} 同步到 ${this.targetTableName}`);

      // 批次處理記錄
      const results = await this.processBatches(updatedRecords);
      
      // 更新同步狀態
      const currentTime = new Date();
      await this.targetAdapter.updateSyncStatus(syncStatusKey, currentTime);

      const duration = new Date() - startTime;
      console.log(`表格 ${this.tableName} 同步完成，耗時 ${duration}ms`);

      return {
        success: true,
        recordsProcessed: results.totalProcessed,
        recordsInserted: results.inserted,
        recordsUpdated: results.updated,
        duration,
        message: '同步成功'
      };

    } catch (error) {
      console.error(`表格 ${this.tableName} 同步失敗:`, error);
      return {
        success: false,
        error: error.message,
        recordsProcessed: 0,
        message: '同步失敗'
      };
    }
  }

  /**
   * 批次處理記錄
   * @param {Array} records - 要處理的記錄
   */
  async processBatches(records) {
    const results = {
      totalProcessed: 0,
      inserted: 0,
      updated: 0
    };

    // 分批處理
    for (let i = 0; i < records.length; i += this.batchSize) {
      const batch = records.slice(i, i + this.batchSize);
      console.log(`處理批次 ${Math.floor(i / this.batchSize) + 1}/${Math.ceil(records.length / this.batchSize)} (${batch.length} 筆記錄)`);

      const batchResults = await this.processBatch(batch);
      results.totalProcessed += batchResults.processed;
      results.inserted += batchResults.inserted;
      results.updated += batchResults.updated;
    }

    return results;
  }

  /**
   * 處理單一批次
   * @param {Array} batch - 批次記錄
   */
  async processBatch(batch) {
    const toInsert = [];
    const toUpdate = [];

    // 檢查每筆記錄是否已存在
    for (const record of batch) {
      const keyValue = record[this.keyColumn];
      if (!keyValue) {
        console.warn(`記錄缺少主鍵值，跳過: ${JSON.stringify(record)}`);
        continue;
      }

      try {
        const exists = await this.targetAdapter.exists(this.targetTableName, this.keyColumn, keyValue);
        if (exists) {
          toUpdate.push(record);
        } else {
          toInsert.push(record);
        }
      } catch (error) {
        console.error(`檢查記錄存在性失敗 (${this.keyColumn}=${keyValue}):`, error);
        continue;
      }
    }

    // 執行插入和更新
    let inserted = 0, updated = 0;

    if (toInsert.length > 0) {
      try {
        await this.targetAdapter.batchInsert(this.targetTableName, toInsert);
        inserted = toInsert.length;
      } catch (error) {
        console.error('批次插入失敗:', error);
        // 嘗試逐筆插入
        inserted = await this.insertOneByOne(toInsert);
      }
    }

    if (toUpdate.length > 0) {
      try {
        await this.targetAdapter.batchUpdate(this.targetTableName, toUpdate, this.keyColumn);
        updated = toUpdate.length;
      } catch (error) {
        console.error('批次更新失敗:', error);
        // 嘗試逐筆更新
        updated = await this.updateOneByOne(toUpdate);
      }
    }

    return {
      processed: inserted + updated,
      inserted,
      updated
    };
  }

  /**
   * 逐筆插入（當批次插入失敗時的備用方案）
   * @param {Array} records - 要插入的記錄
   */
  async insertOneByOne(records) {
    let successful = 0;
    for (const record of records) {
      try {
        await this.targetAdapter.batchInsert(this.targetTableName, [record]);
        successful++;
      } catch (error) {
        console.error(`插入記錄失敗 (${this.keyColumn}=${record[this.keyColumn]}):`, error);
      }
    }
    return successful;
  }

  /**
   * 逐筆更新（當批次更新失敗時的備用方案）
   * @param {Array} records - 要更新的記錄
   */
  async updateOneByOne(records) {
    let successful = 0;
    for (const record of records) {
      try {
        await this.targetAdapter.batchUpdate(this.targetTableName, [record], this.keyColumn);
        successful++;
      } catch (error) {
        console.error(`更新記錄失敗 (${this.keyColumn}=${record[this.keyColumn]}):`, error);
      }
    }
    return successful;
  }
}

module.exports = SyncJob; 