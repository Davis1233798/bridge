// Jest 測試設定檔案
require('dotenv').config();

// 設定測試超時時間
jest.setTimeout(30000);

// 全域測試設定
beforeAll(() => {
  console.log('🚀 開始資料庫 CRUD 測試...');
});

afterAll(() => {
  console.log('✅ 所有測試完成');
}); 