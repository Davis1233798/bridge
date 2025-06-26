#!/usr/bin/env node
/**
 * 資料庫設置腳本
 * 建立 test_polling 和 test_syncing 表格在兩個資料庫中
 */

require('dotenv').config();
const AdapterFactory = require('../src/adapters/AdapterFactory');
const { logger } = require('../src/utils/logger');

class DatabaseSetup {
  constructor() {
    this.clientAdapter = null;
    this.serverAdapter = null;
  }

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

      // 建立伺服器端連接（MariaDB）
      this.serverAdapter = AdapterFactory.createAdapter(process.env.SERVER_DB_TYPE, {
        type: process.env.SERVER_DB_TYPE,
        host: process.env.SERVER_DB_HOST,
        port: parseInt(process.env.SERVER_DB_PORT),
        user: process.env.SERVER_DB_USER,
        password: process.env.SERVER_DB_PASSWORD,
        database: process.env.SERVER_DB_DATABASE
      });

      await this.clientAdapter.connect();
      await this.serverAdapter.connect();
      
      logger.info('資料庫連接初始化完成');
      logger.info(`MSSQL: ${process.env.CLIENT_DB_HOST}:${process.env.CLIENT_DB_PORT}`);
      logger.info(`MariaDB: ${process.env.SERVER_DB_HOST}:${process.env.SERVER_DB_PORT}`);
    } catch (error) {
      logger.error('資料庫連接初始化失敗:', error);
      throw error;
    }
  }

  async createTables() {
    await this.createMSSQLTables();
    await this.createMariaDBTables();
  }

  async createMSSQLTables() {
    logger.info('建立 MSSQL 表格...');

    // 建立 test_polling 表格
    const mssqlPollingSQL = `
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'test_polling')
      BEGIN
        CREATE TABLE test_polling (
          id int IDENTITY(1,1) PRIMARY KEY,
          name NVARCHAR(255) NOT NULL,
          email NVARCHAR(255),
          age INT,
          status NVARCHAR(50) DEFAULT 'active',
          created_at DATETIME2 DEFAULT GETDATE(),
          updated_at DATETIME2 DEFAULT GETDATE()
        );
        
        CREATE TRIGGER tr_test_polling_updated_at
        ON test_polling
        AFTER UPDATE
        AS
        BEGIN
          UPDATE test_polling
          SET updated_at = GETDATE()
          FROM test_polling t
          INNER JOIN inserted i ON t.id = i.id
        END
      END
    `;

    // 建立 test_syncing 表格
    const mssqlSyncingSQL = `
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'test_syncing')
      BEGIN
        CREATE TABLE test_syncing (
          id int IDENTITY(1,1) PRIMARY KEY,
          name NVARCHAR(255) NOT NULL,
          email NVARCHAR(255),
          age INT,
          status NVARCHAR(50) DEFAULT 'active',
          created_at DATETIME2 DEFAULT GETDATE(),
          updated_at DATETIME2 DEFAULT GETDATE()
        );
        
        CREATE TRIGGER tr_test_syncing_updated_at
        ON test_syncing
        AFTER UPDATE
        AS
        BEGIN
          UPDATE test_syncing
          SET updated_at = GETDATE()
          FROM test_syncing t
          INNER JOIN inserted i ON t.id = i.id
        END
      END
    `;

    await this.clientAdapter.query(mssqlPollingSQL);
    await this.clientAdapter.query(mssqlSyncingSQL);
    
    logger.info('MSSQL 表格建立完成');
  }

  async createMariaDBTables() {
    logger.info('建立 MariaDB 表格...');

    // 建立 test_polling 表格
    const mariaPollingSQL = `
      CREATE TABLE IF NOT EXISTS test_polling (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        age INT,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_updated_at (updated_at),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    // 建立 test_syncing 表格
    const mariaSyncingSQL = `
      CREATE TABLE IF NOT EXISTS test_syncing (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        age INT,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_updated_at (updated_at),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await this.serverAdapter.query(mariaPollingSQL);
    await this.serverAdapter.query(mariaSyncingSQL);
    
    logger.info('MariaDB 表格建立完成');
  }

  async checkTables() {
    logger.info('檢查表格狀態...');

    // 檢查 MSSQL 表格
    const mssqlTables = await this.clientAdapter.query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME IN ('test_polling', 'test_syncing')
    `);
    logger.info('MSSQL 表格:', mssqlTables.map(t => t.TABLE_NAME));

    // 檢查 MariaDB 表格
    const mariaTables = await this.serverAdapter.query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = '${process.env.SERVER_DB_DATABASE}' 
      AND TABLE_NAME IN ('test_polling', 'test_syncing')
    `);
    logger.info('MariaDB 表格:', mariaTables.map(t => t.TABLE_NAME));

    // 檢查資料數量
    const mssqlPollingCount = await this.clientAdapter.query('SELECT COUNT(*) as count FROM test_polling');
    const mssqlSyncingCount = await this.clientAdapter.query('SELECT COUNT(*) as count FROM test_syncing');
    const mariaPollingCount = await this.serverAdapter.query('SELECT COUNT(*) as count FROM test_polling');
    const mariaSyncingCount = await this.serverAdapter.query('SELECT COUNT(*) as count FROM test_syncing');

    logger.info('資料數量統計:');
    logger.info(`MSSQL test_polling: ${mssqlPollingCount[0].count} 筆`);
    logger.info(`MSSQL test_syncing: ${mssqlSyncingCount[0].count} 筆`);
    logger.info(`MariaDB test_polling: ${mariaPollingCount[0].count} 筆`);
    logger.info(`MariaDB test_syncing: ${mariaSyncingCount[0].count} 筆`);
  }

  async close() {
    try {
      if (this.clientAdapter && typeof this.clientAdapter.disconnect === 'function') {
        await this.clientAdapter.disconnect();
      }
      if (this.serverAdapter && typeof this.serverAdapter.disconnect === 'function') {
        await this.serverAdapter.disconnect();
      }
      logger.info('資料庫連接已關閉');
    } catch (error) {
      logger.error('關閉資料庫連接失敗:', error);
    }
  }

  async run() {
    try {
      await this.initialize();
      await this.createTables();
      await this.checkTables();
      
      console.log('✅ 資料庫設置完成');
    } catch (error) {
      console.error('❌ 資料庫設置失敗:', error.message);
      throw error;
    } finally {
      await this.close();
    }
  }
}

// 如果直接執行此檔案，則運行設置
if (require.main === module) {
  const setup = new DatabaseSetup();
  setup.run()
    .then(() => {
      console.log('🎉 資料庫設置成功完成！');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 設置失敗:', error.message);
      process.exit(1);
    });
}

module.exports = DatabaseSetup; 