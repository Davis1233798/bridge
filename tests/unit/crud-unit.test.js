const AdapterFactory = require('../../src/adapters/AdapterFactory');

describe('CRUD 單元測試', () => {
  let mariadbAdapter, mssqlAdapter;
  
  const testTable = 'unit_test_table';
  const testData = {
    id: 1,
    name: 'Unit Test User',
    age: 30,
    email: 'unittest@example.com',
    status: 'active'
  };

  beforeAll(async () => {
    // 初始化適配器
    mariadbAdapter = AdapterFactory.createAdapter('mariadb', {
      type: 'mariadb',
      host: process.env.CLIENT_DB_HOST,
      port: parseInt(process.env.CLIENT_DB_PORT),
      user: process.env.CLIENT_DB_USER,
      password: process.env.CLIENT_DB_PASSWORD,
      database: process.env.CLIENT_DB_DATABASE
    });

    mssqlAdapter = AdapterFactory.createAdapter('mssql', {
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
  }, 30000);

  afterAll(async () => {
    // 清理測試表格
    try {
      await mariadbAdapter.executeQuery(`DROP TABLE IF EXISTS ${testTable}`);
      await mssqlAdapter.executeQuery(`DROP TABLE IF EXISTS ${testTable}`);
    } catch (error) {
      console.log('清理表格錯誤（正常）:', error.message);
    }

    await mariadbAdapter.close();
    await mssqlAdapter.close();
  });

  describe('MariaDB CRUD 單元測試', () => {
    beforeEach(async () => {
      // 每個測試前重建表格
      try {
        await mariadbAdapter.executeQuery(`DROP TABLE IF EXISTS ${testTable}`);
      } catch (error) {
        // 忽略
      }

      await mariadbAdapter.executeQuery(`
        CREATE TABLE ${testTable} (
          id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(100) NOT NULL,
          age INT DEFAULT 0,
          email VARCHAR(100),
          status VARCHAR(20) DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    });

    test('MariaDB CREATE 操作', async () => {
      console.log('測試 MariaDB CREATE 操作');
      
      const result = await mariadbAdapter.executeQuery(
        `INSERT INTO ${testTable} (name, age, email, status) VALUES (?, ?, ?, ?)`,
        [testData.name, testData.age, testData.email, testData.status]
      );
      
      expect(result.affectedRows).toBe(1);
      
      // 驗證資料是否插入成功
      const selectResult = await mariadbAdapter.executeQuery(`SELECT * FROM ${testTable} WHERE name = ?`, [testData.name]);
      expect(selectResult.length).toBe(1);
      expect(selectResult[0].name).toBe(testData.name);
    });

    test('MariaDB READ 操作', async () => {
      console.log('測試 MariaDB READ 操作');
      
      // 先插入測試資料
      await mariadbAdapter.executeQuery(
        `INSERT INTO ${testTable} (name, age, email, status) VALUES (?, ?, ?, ?)`,
        [testData.name, testData.age, testData.email, testData.status]
      );
      
      // 測試讀取
      const result = await mariadbAdapter.executeQuery(`SELECT * FROM ${testTable}`);
      expect(result.length).toBe(1);
      expect(result[0].name).toBe(testData.name);
      expect(result[0].age).toBe(testData.age);
      expect(result[0].email).toBe(testData.email);
      expect(result[0].status).toBe(testData.status);
    });

    test('MariaDB UPDATE 操作', async () => {
      console.log('測試 MariaDB UPDATE 操作');
      
      // 先插入測試資料
      await mariadbAdapter.executeQuery(
        `INSERT INTO ${testTable} (name, age, email, status) VALUES (?, ?, ?, ?)`,
        [testData.name, testData.age, testData.email, testData.status]
      );
      
      // 更新資料
      const updateResult = await mariadbAdapter.executeQuery(
        `UPDATE ${testTable} SET age = ?, status = ? WHERE name = ?`,
        [35, 'updated', testData.name]
      );
      
      expect(updateResult.affectedRows).toBe(1);
      
      // 驗證更新結果
      const selectResult = await mariadbAdapter.executeQuery(`SELECT * FROM ${testTable} WHERE name = ?`, [testData.name]);
      expect(selectResult[0].age).toBe(35);
      expect(selectResult[0].status).toBe('updated');
    });

    test('MariaDB DELETE 操作', async () => {
      console.log('測試 MariaDB DELETE 操作');
      
      // 先插入測試資料
      await mariadbAdapter.executeQuery(
        `INSERT INTO ${testTable} (name, age, email, status) VALUES (?, ?, ?, ?)`,
        [testData.name, testData.age, testData.email, testData.status]
      );
      
      // 驗證資料存在
      let selectResult = await mariadbAdapter.executeQuery(`SELECT * FROM ${testTable}`);
      expect(selectResult.length).toBe(1);
      
      // 刪除資料
      const deleteResult = await mariadbAdapter.executeQuery(`DELETE FROM ${testTable} WHERE name = ?`, [testData.name]);
      expect(deleteResult.affectedRows).toBe(1);
      
      // 驗證資料已刪除
      selectResult = await mariadbAdapter.executeQuery(`SELECT * FROM ${testTable}`);
      expect(selectResult.length).toBe(0);
    });

    test('MariaDB 批次操作', async () => {
      console.log('測試 MariaDB 批次操作');
      
      const batchData = [
        ['User 1', 25, 'user1@test.com', 'active'],
        ['User 2', 30, 'user2@test.com', 'inactive'],
        ['User 3', 28, 'user3@test.com', 'active']
      ];
      
      // 批次插入
      for (const data of batchData) {
        await mariadbAdapter.executeQuery(
          `INSERT INTO ${testTable} (name, age, email, status) VALUES (?, ?, ?, ?)`,
          data
        );
      }
      
      // 驗證批次插入結果
      const result = await mariadbAdapter.executeQuery(`SELECT * FROM ${testTable} ORDER BY name`);
      expect(result.length).toBe(3);
      expect(result[0].name).toBe('User 1');
      expect(result[1].name).toBe('User 2');
      expect(result[2].name).toBe('User 3');
    });
  });

  describe('MSSQL CRUD 單元測試', () => {
    beforeEach(async () => {
      // 每個測試前重建表格
      try {
        await mssqlAdapter.executeQuery(`DROP TABLE IF EXISTS ${testTable}`);
      } catch (error) {
        // 忽略
      }

      await mssqlAdapter.executeQuery(`
        CREATE TABLE ${testTable} (
          id INT IDENTITY(1,1) PRIMARY KEY,
          name NVARCHAR(100) NOT NULL,
          age INT DEFAULT 0,
          email NVARCHAR(100),
          status NVARCHAR(20) DEFAULT 'active',
          created_at DATETIME2 DEFAULT GETDATE(),
          updated_at DATETIME2 DEFAULT GETDATE()
        )
      `);
    });

    test('MSSQL CREATE 操作', async () => {
      console.log('測試 MSSQL CREATE 操作');
      
      const result = await mssqlAdapter.executeQuery(
        `INSERT INTO ${testTable} (name, age, email, status) VALUES (@name, @age, @email, @status)`,
        { name: testData.name, age: testData.age, email: testData.email, status: testData.status }
      );
      
      expect(result.rowsAffected[0]).toBe(1);
      
      // 驗證資料是否插入成功
      const selectResult = await mssqlAdapter.executeQuery(`SELECT * FROM ${testTable} WHERE name = @name`, { name: testData.name });
      expect(selectResult.length).toBe(1);
      expect(selectResult[0].name).toBe(testData.name);
    });

    test('MSSQL READ 操作', async () => {
      console.log('測試 MSSQL READ 操作');
      
      // 先插入測試資料
      await mssqlAdapter.executeQuery(
        `INSERT INTO ${testTable} (name, age, email, status) VALUES (@name, @age, @email, @status)`,
        { name: testData.name, age: testData.age, email: testData.email, status: testData.status }
      );
      
      // 測試讀取
      const result = await mssqlAdapter.executeQuery(`SELECT * FROM ${testTable}`);
      expect(result.length).toBe(1);
      expect(result[0].name).toBe(testData.name);
      expect(result[0].age).toBe(testData.age);
      expect(result[0].email).toBe(testData.email);
      expect(result[0].status).toBe(testData.status);
    });

    test('MSSQL UPDATE 操作', async () => {
      console.log('測試 MSSQL UPDATE 操作');
      
      // 先插入測試資料
      await mssqlAdapter.executeQuery(
        `INSERT INTO ${testTable} (name, age, email, status) VALUES (@name, @age, @email, @status)`,
        { name: testData.name, age: testData.age, email: testData.email, status: testData.status }
      );
      
      // 更新資料
      const updateResult = await mssqlAdapter.executeQuery(
        `UPDATE ${testTable} SET age = @age, status = @status WHERE name = @name`,
        { age: 35, status: 'updated', name: testData.name }
      );
      
      expect(updateResult.rowsAffected[0]).toBe(1);
      
      // 驗證更新結果
      const selectResult = await mssqlAdapter.executeQuery(`SELECT * FROM ${testTable} WHERE name = @name`, { name: testData.name });
      expect(selectResult[0].age).toBe(35);
      expect(selectResult[0].status).toBe('updated');
    });

    test('MSSQL DELETE 操作', async () => {
      console.log('測試 MSSQL DELETE 操作');
      
      // 先插入測試資料
      await mssqlAdapter.executeQuery(
        `INSERT INTO ${testTable} (name, age, email, status) VALUES (@name, @age, @email, @status)`,
        { name: testData.name, age: testData.age, email: testData.email, status: testData.status }
      );
      
      // 驗證資料存在
      let selectResult = await mssqlAdapter.executeQuery(`SELECT * FROM ${testTable}`);
      expect(selectResult.length).toBe(1);
      
      // 刪除資料
      const deleteResult = await mssqlAdapter.executeQuery(`DELETE FROM ${testTable} WHERE name = @name`, { name: testData.name });
      expect(deleteResult.rowsAffected[0]).toBe(1);
      
      // 驗證資料已刪除
      selectResult = await mssqlAdapter.executeQuery(`SELECT * FROM ${testTable}`);
      expect(selectResult.length).toBe(0);
    });

    test('MSSQL 批次操作', async () => {
      console.log('測試 MSSQL 批次操作');
      
      const batchData = [
        { name: 'User 1', age: 25, email: 'user1@test.com', status: 'active' },
        { name: 'User 2', age: 30, email: 'user2@test.com', status: 'inactive' },
        { name: 'User 3', age: 28, email: 'user3@test.com', status: 'active' }
      ];
      
      // 批次插入
      for (const data of batchData) {
        await mssqlAdapter.executeQuery(
          `INSERT INTO ${testTable} (name, age, email, status) VALUES (@name, @age, @email, @status)`,
          data
        );
      }
      
      // 驗證批次插入結果
      const result = await mssqlAdapter.executeQuery(`SELECT * FROM ${testTable} ORDER BY name`);
      expect(result.length).toBe(3);
      expect(result[0].name).toBe('User 1');
      expect(result[1].name).toBe('User 2');
      expect(result[2].name).toBe('User 3');
    });
  });

  describe('連接與錯誤處理測試', () => {
    test('MariaDB 連接測試', async () => {
      console.log('測試 MariaDB 連接');
      
      const result = await mariadbAdapter.executeQuery('SELECT 1 as test_connection');
      expect(result[0].test_connection).toBe(1);
    });

    test('MSSQL 連接測試', async () => {
      console.log('測試 MSSQL 連接');
      
      const result = await mssqlAdapter.executeQuery('SELECT 1 as test_connection');
      expect(result[0].test_connection).toBe(1);
    });

    test('MariaDB 錯誤處理測試', async () => {
      console.log('測試 MariaDB 錯誤處理');
      
      await expect(
        mariadbAdapter.executeQuery('SELECT * FROM non_existent_table')
      ).rejects.toThrow();
    });

    test('MSSQL 錯誤處理測試', async () => {
      console.log('測試 MSSQL 錯誤處理');
      
      await expect(
        mssqlAdapter.executeQuery('SELECT * FROM non_existent_table')
      ).rejects.toThrow();
    });
  });
}); 