const SyncIntegrationTest = require('./sync-integration.test.js');

describe('雙向同步整合測試', () => {
  let syncTest;

  beforeAll(async () => {
    console.log('=== 開始雙向同步整合測試 ===');
    syncTest = new SyncIntegrationTest();
    await syncTest.initialize();
    await syncTest.createTables();
  }, 30000);

  afterAll(async () => {
    if (syncTest) {
      await syncTest.close();
    }
    console.log('=== 雙向同步整合測試結束 ===');
  });

  beforeEach(async () => {
    // 每個測試前清理表格
    await syncTest.cleanupTables();
  }, 10000);

  describe('1. MariaDB test_polling CRUD -> MSSQL test_syncing 同步測試', () => {
    test('1.1 MariaDB CRUD 基本功能測試', async () => {
      console.log('\n--- 測試 1.1: MariaDB CRUD 基本功能 ---');
      
      // 插入測試資料
      await syncTest.insertToMariaDB();
      
      // 驗證 MariaDB 資料
      const verification = await syncTest.verifyDataConsistency();
      expect(verification.mariadbCount).toBe(3);
      
      // 執行 CRUD 操作
      await syncTest.performMariaDBCRUD();
      
      // 驗證 CRUD 後的資料變化
      const afterCrud = await syncTest.verifyDataConsistency();
      expect(afterCrud.mariadbCount).toBeGreaterThan(0);
      
      console.log('✅ MariaDB CRUD 基本功能測試通過');
    }, 15000);

    test('1.2 MariaDB -> MSSQL 同步功能測試', async () => {
      console.log('\n--- 測試 1.2: MariaDB -> MSSQL 同步功能 ---');
      
      // 在 MariaDB 插入資料
      await syncTest.insertToMariaDB();
      
      // 執行同步
      const syncResult = await syncTest.syncMariaDBToMSSSQL();
      expect(syncResult.success).toBe(true);
      expect(syncResult.recordsProcessed).toBeGreaterThan(0);
      
      // 驗證同步後的資料一致性
      const verification = await syncTest.verifyDataConsistency();
      expect(verification.isConsistent).toBe(true);
      expect(verification.mssqlCount).toBe(verification.mariadbCount);
      
      console.log('✅ MariaDB -> MSSQL 同步功能測試通過');
    }, 20000);

    test('1.3 MariaDB CRUD 後 MSSQL 自動跟隨測試', async () => {
      console.log('\n--- 測試 1.3: MariaDB CRUD 後 MSSQL 自動跟隨 ---');
      
      // 初始資料同步
      await syncTest.insertToMariaDB();
      await syncTest.syncMariaDBToMSSSQL();
      
      // 記錄初始狀態
      const initialState = await syncTest.verifyDataConsistency();
      
      // 在 MariaDB 執行 CRUD 操作
      await syncTest.performMariaDBCRUD();
      
      // 等待一小段時間模擬實際環境
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 執行同步
      const syncResult = await syncTest.syncMariaDBToMSSSQL();
      expect(syncResult.success).toBe(true);
      
      // 驗證 MSSQL 是否跟隨 MariaDB 的變化
      const finalState = await syncTest.verifyDataConsistency();
      expect(finalState.isConsistent).toBe(true);
      
      console.log('✅ MariaDB CRUD 後 MSSQL 自動跟隨測試通過');
    }, 25000);
  });

  describe('2. MSSQL test_polling CRUD -> MariaDB test_syncing 同步測試', () => {
    test('2.1 MSSQL CRUD 基本功能測試', async () => {
      console.log('\n--- 測試 2.1: MSSQL CRUD 基本功能 ---');
      
      // 插入測試資料
      await syncTest.insertToMSSSQL();
      
      // 驗證 MSSQL 資料
      const verification = await syncTest.verifyDataConsistency();
      expect(verification.mssqlCount).toBe(3);
      
      // 執行 CRUD 操作
      await syncTest.performMSSQLCRUD();
      
      // 驗證 CRUD 後的資料變化
      const afterCrud = await syncTest.verifyDataConsistency();
      expect(afterCrud.mssqlCount).toBeGreaterThan(0);
      
      console.log('✅ MSSQL CRUD 基本功能測試通過');
    }, 15000);

    test('2.2 MSSQL -> MariaDB 同步功能測試', async () => {
      console.log('\n--- 測試 2.2: MSSQL -> MariaDB 同步功能 ---');
      
      // 在 MSSQL 插入資料
      await syncTest.insertToMSSSQL();
      
      // 執行同步
      const syncResult = await syncTest.syncMSSQLToMariaDB();
      expect(syncResult.success).toBe(true);
      expect(syncResult.recordsProcessed).toBeGreaterThan(0);
      
      // 驗證同步後的資料一致性
      const verification = await syncTest.verifyDataConsistency();
      expect(verification.isConsistent).toBe(true);
      expect(verification.mariadbCount).toBe(verification.mssqlCount);
      
      console.log('✅ MSSQL -> MariaDB 同步功能測試通過');
    }, 20000);

    test('2.3 MSSQL CRUD 後 MariaDB 自動跟隨測試', async () => {
      console.log('\n--- 測試 2.3: MSSQL CRUD 後 MariaDB 自動跟隨 ---');
      
      // 初始資料同步
      await syncTest.insertToMSSSQL();
      await syncTest.syncMSSQLToMariaDB();
      
      // 記錄初始狀態
      const initialState = await syncTest.verifyDataConsistency();
      
      // 在 MSSQL 執行 CRUD 操作
      await syncTest.performMSSQLCRUD();
      
      // 等待一小段時間模擬實際環境
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 執行同步
      const syncResult = await syncTest.syncMSSQLToMariaDB();
      expect(syncResult.success).toBe(true);
      
      // 驗證 MariaDB 是否跟隨 MSSQL 的變化
      const finalState = await syncTest.verifyDataConsistency();
      expect(finalState.isConsistent).toBe(true);
      
      console.log('✅ MSSQL CRUD 後 MariaDB 自動跟隨測試通過');
    }, 25000);
  });

  describe('3. 雙向同步壓力測試', () => {
    test('3.1 大量資料同步測試', async () => {
      console.log('\n--- 測試 3.1: 大量資料同步測試 ---');
      
      // 建立大量測試資料
      const largeDataSet = [];
      for (let i = 1; i <= 100; i++) {
        largeDataSet.push({
          id: i,
          name: `Bulk User ${i}`,
          age: 20 + (i % 50),
          email: `bulkuser${i}@example.com`,
          status: i % 2 === 0 ? 'active' : 'inactive'
        });
      }
      
      // 插入大量資料到 MariaDB
      await syncTest.insertToMariaDB(largeDataSet);
      
      // 同步到 MSSQL
      const syncResult = await syncTest.syncMariaDBToMSSSQL();
      expect(syncResult.success).toBe(true);
      expect(syncResult.recordsProcessed).toBe(100);
      
      // 驗證資料一致性
      const verification = await syncTest.verifyDataConsistency();
      expect(verification.isConsistent).toBe(true);
      expect(verification.mariadbCount).toBe(100);
      expect(verification.mssqlCount).toBe(100);
      
      console.log('✅ 大量資料同步測試通過');
    }, 60000);

    test('3.2 並發 CRUD 操作測試', async () => {
      console.log('\n--- 測試 3.2: 並發 CRUD 操作測試 ---');
      
      // 初始資料準備
      await syncTest.insertToMariaDB();
      await syncTest.syncMariaDBToMSSSQL();
      
      // 模擬並發操作
      const concurrentOperations = [
        syncTest.performMariaDBCRUD(),
        syncTest.performMSSQLCRUD()
      ];
      
      await Promise.all(concurrentOperations);
      
      // 分別同步兩個方向
      const syncResults = await Promise.all([
        syncTest.syncMariaDBToMSSSQL(),
        syncTest.syncMSSQLToMariaDB()
      ]);
      
      syncResults.forEach(result => {
        expect(result.success).toBe(true);
      });
      
      console.log('✅ 並發 CRUD 操作測試通過');
    }, 30000);

    test('3.3 錯誤恢復測試', async () => {
      console.log('\n--- 測試 3.3: 錯誤恢復測試 ---');
      
      // 正常同步流程
      await syncTest.insertToMariaDB();
      const normalSync = await syncTest.syncMariaDBToMSSSQL();
      expect(normalSync.success).toBe(true);
      
      // 嘗試同步不存在的表格（應該會失敗但程式不崩潰）
      try {
        const invalidSyncJob = require('../src/core/SyncJob');
        const invalidJob = new invalidSyncJob(
          syncTest.mariadbAdapter,
          syncTest.mssqlAdapter,
          'non_existent_table'
        );
        const invalidResult = await invalidJob.execute();
        expect(invalidResult.success).toBe(false);
      } catch (error) {
        // 預期會有錯誤，但程式應該能繼續執行
        expect(error).toBeDefined();
      }
      
      // 驗證正常功能仍然可用
      const recoverySync = await syncTest.syncMariaDBToMSSSQL();
      expect(recoverySync.success).toBe(true);
      
      console.log('✅ 錯誤恢復測試通過');
    }, 20000);
  });

  describe('4. 資料一致性驗證測試', () => {
    test('4.1 時間戳同步驗證', async () => {
      console.log('\n--- 測試 4.1: 時間戳同步驗證 ---');
      
      await syncTest.insertToMariaDB();
      await syncTest.syncMariaDBToMSSSQL();
      
      const verification = await syncTest.verifyDataConsistency();
      
      // 檢查兩邊的資料筆數是否一致
      expect(verification.isConsistent).toBe(true);
      
      // 檢查時間戳欄位是否正確同步
      const mariadbWithTimestamp = verification.mariadbData.filter(record => record.updated_at);
      const mssqlWithTimestamp = verification.mssqlData.filter(record => record.updated_at);
      
      expect(mariadbWithTimestamp.length).toBeGreaterThan(0);
      expect(mssqlWithTimestamp.length).toBeGreaterThan(0);
      
      console.log('✅ 時間戳同步驗證測試通過');
    }, 15000);

    test('4.2 資料完整性檢查', async () => {
      console.log('\n--- 測試 4.2: 資料完整性檢查 ---');
      
      await syncTest.insertToMariaDB();
      await syncTest.syncMariaDBToMSSSQL();
      
      const verification = await syncTest.verifyDataConsistency();
      
      // 檢查每筆記錄的完整性
      verification.mariadbData.forEach((mariaRecord, index) => {
        const mssqlRecord = verification.mssqlData[index];
        if (mssqlRecord) {
          expect(mariaRecord.name).toBe(mssqlRecord.name);
          expect(mariaRecord.age).toBe(mssqlRecord.age);
          expect(mariaRecord.email).toBe(mssqlRecord.email);
          expect(mariaRecord.status).toBe(mssqlRecord.status);
        }
      });
      
      console.log('✅ 資料完整性檢查測試通過');
    }, 15000);
  });
}); 