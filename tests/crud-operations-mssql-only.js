require('dotenv').config();
const AdapterFactory = require('../src/adapters/AdapterFactory');
const { logger } = require('../src/utils/logger');

/**
 * test_polling 表格 CRUD 操作測試類 (僅 MSSQL)
 */
class TestPollingMSSQLCRUD {
  constructor() {
    this.clientAdapter = null;
  }

  /**
   * 初始化資料庫連接
   */
  async initialize() {
    try {
      // 建立客戶端連接（MSSQL）
      this.clientAdapter = AdapterFactory.createAdapter(process.env.CLIENT_DB_TYPE, {
        type: process.env.CLIENT_DB_TYPE,
        host: process.env.CLIENT_DB_HOST,
        port: parseInt(process.env.CLIENT_DB_PORT),
        user: process.env.CLIENT_DB_USER,
        password: process.env.CLIENT_DB_PASSWORD,
        database: process.env.CLIENT_DB_DATABASE,
        server: process.env.CLIENT_DB_HOST,
        options: {
          encrypt: true,
          trustServerCertificate: true
        }
      });

      await this.clientAdapter.connect();
      
      logger.info('MSSQL 資料庫連接初始化完成');
    } catch (error) {
      logger.error('資料庫連接初始化失敗:', error);
      throw error;
    }
  }

  /**
   * 建立 test_polling 表格
   */
  async createTables() {
    const tableName = 'test_polling';
    
    // MSSQL 表格結構
    const mssqlCreateSQL = `
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = '${tableName}')
      BEGIN
        CREATE TABLE ${tableName} (
          id int IDENTITY(1,1) PRIMARY KEY,
          name NVARCHAR(255) NOT NULL,
          email NVARCHAR(255),
          age INT,
          status NVARCHAR(50) DEFAULT 'active',
          created_at DATETIME2 DEFAULT GETDATE(),
          updated_at DATETIME2 DEFAULT GETDATE()
        );
      END
    `;

    // 建立觸發器的 SQL（分開執行）
    const triggerSQL = `
      IF NOT EXISTS (SELECT * FROM sys.triggers WHERE name = 'tr_${tableName}_updated_at')
      BEGIN
        EXEC('
        CREATE TRIGGER tr_${tableName}_updated_at
        ON ${tableName}
        AFTER UPDATE
        AS
        BEGIN
          UPDATE ${tableName}
          SET updated_at = GETDATE()
          FROM ${tableName} t
          INNER JOIN inserted i ON t.id = i.id
        END
        ')
      END
    `;

    try {
      logger.info('建立 test_polling 表格...');
      
      await this.clientAdapter.query(mssqlCreateSQL);
      logger.info('MSSQL test_polling 表格建立完成');
      
      await this.clientAdapter.query(triggerSQL);
      logger.info('MSSQL 觸發器建立完成');
      
    } catch (error) {
      logger.error('建立表格失敗:', error);
      throw error;
    }
  }

  /**
   * 插入測試資料 (CREATE)
   */
  async insertTestData() {
    const testData = [
      { name: '王小明', email: 'wang@example.com', age: 25 },
      { name: '李小花', email: 'li@example.com', age: 30 },
      { name: '陳大寶', email: 'chen@example.com', age: 28 },
      { name: '張美麗', email: 'zhang@example.com', age: 32 },
      { name: '劉志明', email: 'liu@example.com', age: 27 }
    ];

    try {
      logger.info('插入測試資料到 MSSQL...');
      
      for (const data of testData) {
        const sql = `
          INSERT INTO test_polling (name, email, age) 
          VALUES (N'${data.name}', '${data.email}', ${data.age})
        `;
        await this.clientAdapter.query(sql);
      }
      
      logger.info(`成功插入 ${testData.length} 筆測試資料到 MSSQL`);
      
    } catch (error) {
      logger.error('插入測試資料失敗:', error);
      throw error;
    }
  }

  /**
   * 查詢資料 (READ)
   */
  async readData() {
    try {
      logger.info('查詢 MSSQL 資料...');
      const clientData = await this.clientAdapter.query('SELECT * FROM test_polling ORDER BY id');
      logger.info('MSSQL 資料:', clientData);

      return { client: clientData };
    } catch (error) {
      logger.error('查詢資料失敗:', error);
      throw error;
    }
  }

  /**
   * 更新資料 (UPDATE)
   */
  async updateData() {
    try {
      logger.info('更新 MSSQL 資料...');
      
      // 更新第一筆記錄（使用實際存在的欄位）
      const updateSQL = `
        UPDATE test_polling 
        SET age = 26, is_active = 0
        WHERE id = 1
      `;
      
      await this.clientAdapter.query(updateSQL);
      logger.info('MSSQL 資料更新完成');

      // 等待1秒確保 updated_at 時間戳更新
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 查詢更新後的資料
      const updatedData = await this.clientAdapter.query('SELECT * FROM test_polling WHERE id = 1');
      logger.info('更新後的資料:', updatedData);

    } catch (error) {
      logger.error('更新資料失敗:', error);
      throw error;
    }
  }

  /**
   * 刪除資料 (DELETE)
   */
  async deleteData() {
    try {
      logger.info('刪除 MSSQL 測試資料...');
      
      // 刪除最後一筆記錄
      const deleteSQL = 'DELETE FROM test_polling WHERE id = (SELECT MAX(id) FROM test_polling)';
      await this.clientAdapter.query(deleteSQL);
      
      logger.info('資料刪除完成');

      // 查詢刪除後的資料
      const remainingData = await this.clientAdapter.query('SELECT COUNT(*) as count FROM test_polling');
      logger.info('剩餘資料筆數:', remainingData[0].count);

    } catch (error) {
      logger.error('刪除資料失敗:', error);
      throw error;
    }
  }

  /**
   * 測試同步功能相關的查詢
   */
  async testSyncQueries() {
    try {
      logger.info('測試同步功能相關查詢...');

      // 查詢最近更新的記錄（同步器會用到的查詢）
      const recentUpdatesSQL = `
        SELECT * FROM test_polling 
        WHERE updated_at > DATEADD(minute, -5, GETDATE())
        ORDER BY updated_at DESC
      `;
      
      const recentUpdates = await this.clientAdapter.query(recentUpdatesSQL);
      logger.info('最近5分鐘更新的記錄:', recentUpdates);

      // 查詢表格結構資訊
      const schemaInfoSQL = `
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'test_polling'
        ORDER BY ORDINAL_POSITION
      `;
      
      const schemaInfo = await this.clientAdapter.query(schemaInfoSQL);
      logger.info('表格結構資訊:', schemaInfo);

    } catch (error) {
      logger.error('測試同步查詢失敗:', error);
      throw error;
    }
  }

  /**
   * 清理測試資料
   */
  async cleanup() {
    try {
      logger.info('清理測試資料...');
      
      await this.clientAdapter.query('DELETE FROM test_polling');
      
      logger.info('測試資料清理完成');
    } catch (error) {
      logger.error('清理測試資料失敗:', error);
      throw error;
    }
  }

  /**
   * 關閉資料庫連接
   */
  async close() {
    try {
      if (this.clientAdapter && typeof this.clientAdapter.disconnect === 'function') {
        await this.clientAdapter.disconnect();
      }
      logger.info('資料庫連接已關閉');
    } catch (error) {
      logger.error('關閉資料庫連接失敗:', error);
    }
  }

  /**
   * 執行完整的 CRUD 測試
   */
  async runFullTest() {
    try {
      await this.initialize();
      await this.createTables();
      await this.insertTestData();
      await this.readData();
      await this.updateData();
      await this.testSyncQueries();
      await this.deleteData();
      
      logger.info('所有 MSSQL CRUD 測試完成');
      console.log('✅ 所有 MSSQL CRUD 測試完成');
    } catch (error) {
      logger.error('CRUD 測試失敗:', error);
      console.error('❌ CRUD 測試失敗:', error.message);
      throw error;
    } finally {
      await this.close();
    }
  }
}

// 如果直接執行此檔案，則運行測試
if (require.main === module) {
  const crud = new TestPollingMSSQLCRUD();
  crud.runFullTest()
    .then(() => {
      console.log('🎉 MSSQL 測試全部完成！');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 測試失敗:', error.message);
      process.exit(1);
    });
}

module.exports = TestPollingMSSQLCRUD; 