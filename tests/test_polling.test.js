const TestPollingCRUD = require('./crud-operations');

describe('Test Polling CRUD Operations', () => {
  let crud;

  beforeAll(async () => {
    crud = new TestPollingCRUD();
    await crud.initialize();
  });

  afterAll(async () => {
    await crud.cleanup();
    await crud.close();
  });

  beforeEach(async () => {
    // 確保每個測試開始前都有乾淨的環境
    try {
      await crud.cleanup();
    } catch (error) {
      // 忽略清理錯誤（可能表格還不存在）
    }
  });

  test('應該能夠建立 test_polling 表格', async () => {
    await expect(crud.createTables()).resolves.not.toThrow();
  });

  test('應該能夠插入測試資料', async () => {
    await crud.createTables();
    await expect(crud.insertTestData()).resolves.not.toThrow();
  });

  test('應該能夠查詢資料', async () => {
    await crud.createTables();
    await crud.insertTestData();
    
    const data = await crud.readData();
    
    expect(data).toHaveProperty('client');
    expect(data).toHaveProperty('server');
    expect(Array.isArray(data.client)).toBe(true);
    expect(Array.isArray(data.server)).toBe(true);
    expect(data.client.length).toBeGreaterThan(0);
    expect(data.server.length).toBeGreaterThan(0);
  });

  test('應該能夠更新資料', async () => {
    await crud.createTables();
    await crud.insertTestData();
    
    await expect(crud.updateData()).resolves.not.toThrow();
    
    // 驗證更新結果
    const data = await crud.readData();
    const updatedRecord = data.client.find(record => record.id === 1);
    expect(updatedRecord.age).toBe(26);
    expect(updatedRecord.status).toBe('updated');
  });

  test('應該能夠刪除資料', async () => {
    await crud.createTables();
    await crud.insertTestData();
    
    const beforeData = await crud.readData();
    const beforeCount = beforeData.client.length;
    
    await expect(crud.deleteData()).resolves.not.toThrow();
    
    const afterData = await crud.readData();
    const afterCount = afterData.client.length;
    
    expect(afterCount).toBe(beforeCount - 1);
  });

  test('應該能夠執行同步相關查詢', async () => {
    await crud.createTables();
    await crud.insertTestData();
    await crud.updateData(); // 產生一些更新記錄
    
    await expect(crud.testSyncQueries()).resolves.not.toThrow();
  });

  test('完整的 CRUD 流程測試', async () => {
    const newCrud = new TestPollingCRUD();
    await expect(newCrud.runFullTest()).resolves.not.toThrow();
  });
}); 