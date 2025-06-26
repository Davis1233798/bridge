const AdapterFactory = require('../src/adapters/AdapterFactory');
const SyncJob = require('../src/core/SyncJob');
const { syncConfig, dbConfig } = require('../src/config/database');

/**
 * 雙向同步整合測試
 * 測試 MariaDB test_polling <-> MSSQL test_syncing 的雙向同步
 */
class SyncIntegrationTest {
  constructor() {
    this.mariadbAdapter = null;
    this.mssqlAdapter = null;
    
    // 測試表格配置
    this.mariadbTable = 'test_polling';
    this.mssqlTable = 'test_syncing';
    
    // 測試資料
    this.testRecords = [
      { id: 1, name: 'Test User 1', age: 25, email: 'test1@example.com', status: 'active' },
      { id: 2, name: 'Test User 2', age: 30, email: 'test2@example.com', status: 'active' },
      { id: 3, name: 'Test User 3', age: 28, email: 'test3@example.com', status: 'inactive' }
    ];
  }

  /**
   * 初始化適配器
   */
  async initialize() {
    console.log('初始化資料庫適配器...');
    
    // 初始化 MariaDB 適配器
    this.mariadbAdapter = AdapterFactory.createAdapter('mariadb', {
      type: 'mariadb',
      host: process.env.CLIENT_DB_HOST,
      port: parseInt(process.env.CLIENT_DB_PORT),
      user: process.env.CLIENT_DB_USER,
      password: process.env.CLIENT_DB_PASSWORD,
      database: process.env.CLIENT_DB_DATABASE
    });

    // 初始化 MSSQL 適配器
    this.mssqlAdapter = AdapterFactory.createAdapter('mssql', {
      type: 'mssql',
      server: process.env.SERVER_DB_HOST,
      port: parseInt(process.env.SERVER_DB_PORT),
      user: process.env.SERVER_DB_USER,
      password: process.env.SERVER_DB_PASSWORD,
      database: process.env.SERVER_DB_DATABASE,
      options: {
        encrypt: true,
        trustServerCertificate: true
      }
    });

    console.log('適配器初始化完成');
  }

  /**
   * 建立測試表格
   */
  async createTables() {
    console.log('建立測試表格...');
    
    // MariaDB 表格結構
    const mariadbTableSQL = `
      CREATE TABLE IF NOT EXISTS ${this.mariadbTable} (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        age INT DEFAULT 0,
        email VARCHAR(100),
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `;

    // MSSQL 表格結構
    const mssqlTableSQL = `
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='${this.mssqlTable}' AND xtype='U')
      CREATE TABLE ${this.mssqlTable} (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(100) NOT NULL,
        age INT DEFAULT 0,
        email NVARCHAR(100),
        status NVARCHAR(20) DEFAULT 'active',
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE()
      )
    `;

    await this.mariadbAdapter.query(mariadbTableSQL);
    await this.mssqlAdapter.query(mssqlTableSQL);
    
    console.log('測試表格建立完成');
  }

  /**
   * 清理測試表格
   */
  async cleanupTables() {
    console.log('清理測試表格...');
    
    try {
      await this.mariadbAdapter.query(`DELETE FROM ${this.mariadbTable}`);
      await this.mssqlAdapter.query(`DELETE FROM ${this.mssqlTable}`);
      
      // 重置 MariaDB 自增序列
      await this.mariadbAdapter.query(`ALTER TABLE ${this.mariadbTable} AUTO_INCREMENT = 1`);
      
      // 重置 MSSQL 自增序列
      await this.mssqlAdapter.query(`DBCC CHECKIDENT('${this.mssqlTable}', RESEED, 0)`);
      
      console.log('測試表格清理完成');
    } catch (error) {
      console.log('清理表格時發生錯誤（可能表格不存在）:', error.message);
    }
  }

  /**
   * 插入測試資料到 MariaDB
   */
  async insertToMariaDB(records = this.testRecords) {
    console.log(`插入 ${records.length} 筆資料到 MariaDB ${this.mariadbTable}`);
    
    for (const record of records) {
      await this.mariadbAdapter.query(
        `INSERT INTO ${this.mariadbTable} (name, age, email, status) VALUES (?, ?, ?, ?)`,
        [record.name, record.age, record.email, record.status]
      );
    }
    
    console.log('MariaDB 資料插入完成');
  }

  /**
   * 插入測試資料到 MSSQL
   */
  async insertToMSSSQL(records = this.testRecords) {
    console.log(`插入 ${records.length} 筆資料到 MSSQL ${this.mssqlTable}`);
    
    for (const record of records) {
      await this.mssqlAdapter.query(
        `INSERT INTO ${this.mssqlTable} (name, age, email, status) VALUES (@name, @age, @email, @status)`,
        { name: record.name, age: record.age, email: record.email, status: record.status }
      );
    }
    
    console.log('MSSQL 資料插入完成');
  }

  /**
   * 執行 MariaDB 到 MSSQL 的同步
   */
  async syncMariaDBToMSSSQL() {
    console.log('執行 MariaDB 到 MSSQL 同步...');
    
    const syncJob = new SyncJob(
      this.mariadbAdapter,
      this.mssqlAdapter,
      this.mariadbTable,
      { targetTableName: this.mssqlTable }
    );
    
    const result = await syncJob.execute();
    console.log('MariaDB -> MSSQL 同步結果:', result);
    return result;
  }

  /**
   * 執行 MSSQL 到 MariaDB 的同步
   */
  async syncMSSQLToMariaDB() {
    console.log('執行 MSSQL 到 MariaDB 同步...');
    
    const syncJob = new SyncJob(
      this.mssqlAdapter,
      this.mariadbAdapter,
      this.mssqlTable,
      { targetTableName: this.mariadbTable }
    );
    
    const result = await syncJob.execute();
    console.log('MSSQL -> MariaDB 同步結果:', result);
    return result;
  }

  /**
   * 驗證資料一致性
   */
  async verifyDataConsistency() {
    console.log('驗證資料一致性...');
    
    const mariadbData = await this.mariadbAdapter.query(`SELECT * FROM ${this.mariadbTable} ORDER BY id`);
    const mssqlData = await this.mssqlAdapter.query(`SELECT * FROM ${this.mssqlTable} ORDER BY id`);
    
    console.log(`MariaDB 記錄數: ${mariadbData.length}`);
    console.log(`MSSQL 記錄數: ${mssqlData.length}`);
    
    return {
      mariadbCount: mariadbData.length,
      mssqlCount: mssqlData.length,
      mariadbData,
      mssqlData,
      isConsistent: mariadbData.length === mssqlData.length
    };
  }

  /**
   * 在 MariaDB 執行 CRUD 操作
   */
  async performMariaDBCRUD() {
    console.log('在 MariaDB 執行 CRUD 操作...');
    
    // CREATE: 新增記錄
    await this.mariadbAdapter.query(
      `INSERT INTO ${this.mariadbTable} (name, age, email, status) VALUES (?, ?, ?, ?)`,
      ['New User from MariaDB', 35, 'newuser@example.com', 'active']
    );
    
    // READ: 查詢記錄
    const readResult = await this.mariadbAdapter.query(`SELECT * FROM ${this.mariadbTable} WHERE name LIKE '%MariaDB%'`);
    console.log('MariaDB READ 結果:', readResult.length);
    
    // UPDATE: 更新記錄
    await this.mariadbAdapter.query(
      `UPDATE ${this.mariadbTable} SET age = ?, status = ? WHERE name = ?`,
      [40, 'updated', 'New User from MariaDB']
    );
    
    // DELETE: 刪除一筆舊記錄（如果存在）
    await this.mariadbAdapter.query(
      `DELETE FROM ${this.mariadbTable} WHERE id = (SELECT min_id FROM (SELECT MIN(id) as min_id FROM ${this.mariadbTable}) t) LIMIT 1`
    );
    
    console.log('MariaDB CRUD 操作完成');
  }

  /**
   * 在 MSSQL 執行 CRUD 操作
   */
  async performMSSQLCRUD() {
    console.log('在 MSSQL 執行 CRUD 操作...');
    
    // CREATE: 新增記錄
    await this.mssqlAdapter.executeQuery(
      `INSERT INTO ${this.mssqlTable} (name, age, email, status) VALUES (@name, @age, @email, @status)`,
      { name: 'New User from MSSQL', age: 32, email: 'mssqluser@example.com', status: 'active' }
    );
    
    // READ: 查詢記錄
    const readResult = await this.mssqlAdapter.executeQuery(`SELECT * FROM ${this.mssqlTable} WHERE name LIKE '%MSSQL%'`);
    console.log('MSSQL READ 結果:', readResult.length);
    
    // UPDATE: 更新記錄
    await this.mssqlAdapter.executeQuery(
      `UPDATE ${this.mssqlTable} SET age = @age, status = @status WHERE name = @name`,
      { age: 38, status: 'updated', name: 'New User from MSSQL' }
    );
    
    // DELETE: 刪除一筆舊記錄（如果存在）
    await this.mssqlAdapter.executeQuery(
      `DELETE TOP(1) FROM ${this.mssqlTable} WHERE id = (SELECT MIN(id) FROM ${this.mssqlTable})`
    );
    
    console.log('MSSQL CRUD 操作完成');
  }

  /**
   * 關閉連接
   */
  async close() {
    console.log('關閉資料庫連接...');
    
    if (this.mariadbAdapter) {
      await this.mariadbAdapter.close();
    }
    
    if (this.mssqlAdapter) {
      await this.mssqlAdapter.close();
    }
    
    console.log('資料庫連接已關閉');
  }
}

module.exports = SyncIntegrationTest; 