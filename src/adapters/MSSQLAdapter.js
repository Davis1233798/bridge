const sql = require('mssql');
const BaseAdapter = require('./BaseAdapter');
const { connectionLogger } = require('../utils/logger');

/**
 * MSSQL 資料庫適配器
 */
class MSSQLAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.pool = null;
  }

  async connect() {
    try {
      // 判斷連線類型並記錄適當的資訊
      const isNamedPipe = this.config.connectionType === 'namedpipe';
      const connectionInfo = isNamedPipe ? 
        {
          type: 'Named Pipe',
          server: this.config.server,
          database: this.config.database
        } : 
        {
          type: 'TCP/IP',
          host: this.config.server,
          port: this.config.port,
          database: this.config.database
        };

      connectionLogger.info(`嘗試連線到 MSSQL (${connectionInfo.type})`, connectionInfo);

      // 增加連線超時處理
      const connectWithTimeout = async () => {
        // 準備連線配置
        const configWithTimeout = {
          ...this.config,
          connectionTimeout: this.config.connectionTimeout || 15000, // 15秒連線超時
          requestTimeout: this.config.requestTimeout || 15000, // 15秒請求超時
          pool: {
            ...this.config.pool,
            acquireTimeoutMillis: this.config.pool?.acquireTimeoutMillis || 15000
          }
        };

        // Named Pipe 特殊處理
        if (isNamedPipe) {
          // 移除不適用於 Named Pipe 的設定
          delete configWithTimeout.port;
          delete configWithTimeout.host;
          
          // 確保 Named Pipe 選項正確設定
          configWithTimeout.options = {
            ...configWithTimeout.options,
            useNamedPipes: true,
            instanceName: '', // Named Pipe 不需要實例名稱
          };
          
          connectionLogger.debug('Named Pipe 連線配置', {
            server: configWithTimeout.server,
            database: configWithTimeout.database,
            useNamedPipes: true
          });
        }

        return await Promise.race([
          sql.connect(configWithTimeout),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`MSSQL ${connectionInfo.type} 連線超時 (20秒)`)), 20000)
          )
        ]);
      };

      this.pool = await connectWithTimeout();
      
      connectionLogger.connectionSuccess(`MSSQL (${connectionInfo.type})`, {
        ...this.config,
        connectionType: this.config.connectionType
      });
      
      await this.createSyncStatusTable();
      return this.pool;
    } catch (error) {
      connectionLogger.connectionError(`MSSQL (${this.config.connectionType || 'TCP/IP'})`, this.config, error);
      
      // 清理可能的部分連線
      if (this.pool) {
        try {
          await this.pool.close();
        } catch (cleanupError) {
          connectionLogger.warn('清理 MSSQL 連線池時發生錯誤', { error: cleanupError.message });
        }
        this.pool = null;
      }
      
      throw error;
    }
  }

  async disconnect() {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
      connectionLogger.disconnection('MSSQL', this.config);
    }
  }

  async query(queryString, params = []) {
    if (!this.pool) {
      throw new Error('資料庫未連接');
    }

    try {
      const request = this.pool.request();
      
      // 添加參數
      params.forEach((param, index) => {
        request.input(`param${index}`, param);
      });

      const result = await request.query(queryString);
      return result.recordset;
    } catch (error) {
      console.error('MSSQL 查詢錯誤:', error);
      throw error;
    }
  }

  async batchInsert(tableName, data) {
    if (!data || data.length === 0) return;

    try {
      const table = new sql.Table(tableName);
      
      // 根據第一筆資料設定欄位類型
      if (data[0]) {
        Object.keys(data[0]).forEach(key => {
          const value = data[0][key];
          if (typeof value === 'string') {
            table.columns.add(key, sql.NVarChar(sql.MAX));
          } else if (typeof value === 'number') {
            table.columns.add(key, sql.Int);
          } else if (value instanceof Date) {
            table.columns.add(key, sql.DateTime);
          } else {
            table.columns.add(key, sql.NVarChar(sql.MAX));
          }
        });
      }

      // 添加資料行
      data.forEach(row => {
        table.rows.add(...Object.values(row));
      });

      const request = this.pool.request();
      await request.bulk(table);
      
      console.log(`成功批次插入 ${data.length} 筆資料到 ${tableName}`);
    } catch (error) {
      console.error('MSSQL 批次插入錯誤:', error);
      throw error;
    }
  }

  async batchUpdate(tableName, data, keyColumn) {
    if (!data || data.length === 0) return;

    try {
      for (const row of data) {
        const setClause = Object.keys(row)
          .filter(key => key !== keyColumn)
          .map((key, index) => `[${key}] = @param${index}`)
          .join(', ');

        const updateQuery = `
          UPDATE [${tableName}] 
          SET ${setClause} 
          WHERE [${keyColumn}] = @keyValue
        `;

        const request = this.pool.request();
        
        // 添加 SET 子句的參數
        const params = Object.entries(row).filter(([key]) => key !== keyColumn);
        params.forEach(([key, value], index) => {
          request.input(`param${index}`, value);
        });
        
        // 添加 WHERE 子句的參數
        request.input('keyValue', row[keyColumn]);
        
        await request.query(updateQuery);
      }
      
      console.log(`成功批次更新 ${data.length} 筆資料到 ${tableName}`);
    } catch (error) {
      console.error('MSSQL 批次更新錯誤:', error);
      throw error;
    }
  }

  async exists(tableName, keyColumn, keyValue) {
    try {
      const request = this.pool.request();
      request.input('keyValue', keyValue);
      
      const query = `SELECT COUNT(*) as count FROM [${tableName}] WHERE [${keyColumn}] = @keyValue`;
      const result = await request.query(query);
      
      return result.recordset[0].count > 0;
    } catch (error) {
      console.error('MSSQL 檢查存在錯誤:', error);
      throw error;
    }
  }

  async getLastUpdateTime(tableName, updateColumn) {
    try {
      const query = `SELECT MAX([${updateColumn}]) as lastUpdate FROM [${tableName}]`;
      const result = await this.query(query);
      return result[0]?.lastUpdate || new Date(0);
    } catch (error) {
      console.error('取得最後更新時間錯誤:', error);
      return new Date(0);
    }
  }

  async getUpdatedRecords(tableName, updateColumn, lastUpdate) {
    try {
      const request = this.pool.request();
      request.input('lastUpdate', lastUpdate);
      
      const query = `SELECT * FROM [${tableName}] WHERE [${updateColumn}] > @lastUpdate ORDER BY [${updateColumn}]`;
      const result = await request.query(query);
      
      return result.recordset;
    } catch (error) {
      console.error('取得更新記錄錯誤:', error);
      throw error;
    }
  }

  async createSyncStatusTable() {
    try {
      const query = `
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='sync_status' and xtype='U')
        CREATE TABLE sync_status (
          table_name NVARCHAR(255) PRIMARY KEY,
          last_sync_time DATETIME2,
          created_at DATETIME2 DEFAULT GETDATE(),
          updated_at DATETIME2 DEFAULT GETDATE()
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
      const request = this.pool.request();
      request.input('tableName', tableName);
      request.input('lastSyncTime', lastSyncTime);
      
      const query = `
        MERGE sync_status AS target
        USING (SELECT @tableName as table_name, @lastSyncTime as last_sync_time) AS source
        ON target.table_name = source.table_name
        WHEN MATCHED THEN
          UPDATE SET last_sync_time = source.last_sync_time, updated_at = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (table_name, last_sync_time) VALUES (source.table_name, source.last_sync_time);
      `;
      
      await request.query(query);
    } catch (error) {
      console.error('更新同步狀態錯誤:', error);
      throw error;
    }
  }

  async getSyncStatus(tableName) {
    try {
      const request = this.pool.request();
      request.input('tableName', tableName);
      
      const query = `SELECT last_sync_time FROM sync_status WHERE table_name = @tableName`;
      const result = await request.query(query);
      
      return result.recordset[0]?.last_sync_time || new Date(0);
    } catch (error) {
      console.error('取得同步狀態錯誤:', error);
      return new Date(0);
    }
  }
}

module.exports = MSSQLAdapter; 