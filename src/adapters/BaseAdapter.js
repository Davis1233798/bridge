/**
 * 基礎資料庫適配器抽象類別
 * 定義所有資料庫適配器需要實作的方法
 */
class BaseAdapter {
  constructor(config) {
    this.config = config;
    this.connection = null;
  }

  /**
   * 建立資料庫連接
   */
  async connect() {
    throw new Error('connect() method must be implemented');
  }

  /**
   * 關閉資料庫連接
   */
  async disconnect() {
    throw new Error('disconnect() method must be implemented');
  }

  /**
   * 執行查詢
   * @param {string} query - SQL 查詢語句
   * @param {Array} params - 查詢參數
   */
  async query(query, params = []) {
    throw new Error('query() method must be implemented');
  }

  /**
   * 批次插入資料
   * @param {string} tableName - 表格名稱
   * @param {Array} data - 要插入的資料陣列
   */
  async batchInsert(tableName, data) {
    throw new Error('batchInsert() method must be implemented');
  }

  /**
   * 批次更新資料
   * @param {string} tableName - 表格名稱
   * @param {Array} data - 要更新的資料陣列
   * @param {string} keyColumn - 主鍵欄位
   */
  async batchUpdate(tableName, data, keyColumn) {
    throw new Error('batchUpdate() method must be implemented');
  }

  /**
   * 檢查資料是否存在
   * @param {string} tableName - 表格名稱
   * @param {string} keyColumn - 主鍵欄位
   * @param {any} keyValue - 主鍵值
   */
  async exists(tableName, keyColumn, keyValue) {
    throw new Error('exists() method must be implemented');
  }

  /**
   * 取得表格的最後更新時間
   * @param {string} tableName - 表格名稱
   * @param {string} updateColumn - 更新時間欄位
   */
  async getLastUpdateTime(tableName, updateColumn) {
    throw new Error('getLastUpdateTime() method must be implemented');
  }

  /**
   * 取得指定時間後更新的資料
   * @param {string} tableName - 表格名稱
   * @param {string} updateColumn - 更新時間欄位
   * @param {Date} lastUpdate - 最後更新時間
   */
  async getUpdatedRecords(tableName, updateColumn, lastUpdate) {
    throw new Error('getUpdatedRecords() method must be implemented');
  }

  /**
   * 建立同步狀態表格（如果不存在）
   */
  async createSyncStatusTable() {
    throw new Error('createSyncStatusTable() method must be implemented');
  }

  /**
   * 更新同步狀態
   * @param {string} tableName - 表格名稱
   * @param {Date} lastSyncTime - 最後同步時間
   */
  async updateSyncStatus(tableName, lastSyncTime) {
    throw new Error('updateSyncStatus() method must be implemented');
  }

  /**
   * 取得同步狀態
   * @param {string} tableName - 表格名稱
   */
  async getSyncStatus(tableName) {
    throw new Error('getSyncStatus() method must be implemented');
  }
}

module.exports = BaseAdapter; 