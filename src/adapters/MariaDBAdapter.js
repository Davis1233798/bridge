const mariadb = require('mariadb');
const BaseAdapter = require('./BaseAdapter');

/**
 * MariaDB 資料庫適配器
 */
class MariaDBAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.pool = null;
  }

  async connect() {
    try {
      this.pool = mariadb.createPool({
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
        password: this.config.password,
        database: this.config.database,
        connectionLimit: this.config.connectionLimit || 10,
        acquireTimeout: this.config.acquireTimeout || 60000,
        timeout: this.config.timeout || 60000,
        charset: this.config.charset || 'utf8mb4',
        timezone: this.config.timezone || 'local'
      });
      
      // 測試連接
      const conn = await this.pool.getConnection();
      await conn.release();
      console.log('MariaDB 連接成功');
      await this.createSyncStatusTable();
      return this.pool;
    } catch (error) {
      console.error('MariaDB 連接失敗:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      console.log('MariaDB 連接已關閉');
    }
  }

  async query(queryString, params = []) {
    if (!this.pool) {
      throw new Error('資料庫未連接');
    }

    let conn;
    try {
      conn = await this.pool.getConnection();
      const rows = await conn.query(queryString, params);
      return rows;
    } catch (error) {
      console.error('MariaDB 查詢錯誤:', error);
      throw error;
    } finally {
      if (conn) await conn.release();
    }
  }

  async batchInsert(tableName, data) {
    if (!data || data.length === 0) return;

    try {
      const columns = Object.keys(data[0]);
      const placeholders = columns.map(() => '?').join(', ');
      const columnList = columns.map(col => `\`${col}\``).join(', ');
      
      const query = `INSERT INTO \`${tableName}\` (${columnList}) VALUES (${placeholders})`;
      
      let conn = await this.pool.getConnection();
      try {
        for (const row of data) {
          const values = columns.map(col => row[col]);
          await conn.query(query, values);
        }
      } finally {
        if (conn) await conn.release();
      }
      
      console.log(`成功批次插入 ${data.length} 筆資料到 ${tableName}`);
    } catch (error) {
      console.error('MariaDB 批次插入錯誤:', error);
      throw error;
    }
  }

  async batchUpdate(tableName, data, keyColumn) {
    if (!data || data.length === 0) return;

    try {
      let conn = await this.pool.getConnection();
      try {
        for (const row of data) {
          const columns = Object.keys(row).filter(key => key !== keyColumn);
          const setClause = columns.map(col => `\`${col}\` = ?`).join(', ');
          
          const updateQuery = `
            UPDATE \`${tableName}\` 
            SET ${setClause} 
            WHERE \`${keyColumn}\` = ?
          `;
          
          const values = [...columns.map(col => row[col]), row[keyColumn]];
          await conn.query(updateQuery, values);
        }
      } finally {
        if (conn) await conn.release();
      }
      
      console.log(`成功批次更新 ${data.length} 筆資料到 ${tableName}`);
    } catch (error) {
      console.error('MariaDB 批次更新錯誤:', error);
      throw error;
    }
  }

  async exists(tableName, keyColumn, keyValue) {
    try {
      const query = `SELECT COUNT(*) as count FROM \`${tableName}\` WHERE \`${keyColumn}\` = ?`;
      const result = await this.query(query, [keyValue]);
      
      return result[0].count > 0;
    } catch (error) {
      console.error('MariaDB 檢查存在錯誤:', error);
      throw error;
    }
  }

  async getLastUpdateTime(tableName, updateColumn) {
    try {
      const query = `SELECT MAX(\`${updateColumn}\`) as lastUpdate FROM \`${tableName}\``;
      const result = await this.query(query);
      return result[0]?.lastUpdate || new Date(0);
    } catch (error) {
      console.error('取得最後更新時間錯誤:', error);
      return new Date(0);
    }
  }

  async getUpdatedRecords(tableName, updateColumn, lastUpdate) {
    try {
      const query = `SELECT * FROM \`${tableName}\` WHERE \`${updateColumn}\` > ? ORDER BY \`${updateColumn}\``;
      const result = await this.query(query, [lastUpdate]);
      
      return result;
    } catch (error) {
      console.error('取得更新記錄錯誤:', error);
      throw error;
    }
  }

  async createSyncStatusTable() {
    try {
      const query = `
        CREATE TABLE IF NOT EXISTS sync_status (
          table_name VARCHAR(255) PRIMARY KEY,
          last_sync_time DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `;
      await this.query(query);
    } catch (error) {
      console.error('建立同步狀態表格錯誤:', error);
      throw error;
    }
  }

  async updateSyncStatus(tableName, lastSyncTime) {
    try {
      const query = `
        INSERT INTO sync_status (table_name, last_sync_time) 
        VALUES (?, ?) 
        ON DUPLICATE KEY UPDATE 
        last_sync_time = VALUES(last_sync_time),
        updated_at = CURRENT_TIMESTAMP
      `;
      
      await this.query(query, [tableName, lastSyncTime]);
    } catch (error) {
      console.error('更新同步狀態錯誤:', error);
      throw error;
    }
  }

  async getSyncStatus(tableName) {
    try {
      const query = `SELECT last_sync_time FROM sync_status WHERE table_name = ?`;
      const result = await this.query(query, [tableName]);
      
      return result[0]?.last_sync_time || new Date(0);
    } catch (error) {
      console.error('取得同步狀態錯誤:', error);
      return new Date(0);
    }
  }
}

module.exports = MariaDBAdapter; 