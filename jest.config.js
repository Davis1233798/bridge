module.exports = {
  // 測試環境
  testEnvironment: 'node',
  
  // 測試檔案匹配模式
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],
  
  // 測試覆蓋率設定
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  
  // 要收集覆蓋率的檔案
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/*.spec.js'
  ],
  
  // 測試設定檔案
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // 測試超時時間（毫秒）
  testTimeout: 30000,
  
  // 詳細輸出
  verbose: true,
  
  // 檢測開放句柄
  detectOpenHandles: true,
  
  // 強制退出
  forceExit: true,
  
  // 最大 worker 數量
  maxWorkers: 1, // 因為資料庫操作，限制為單執行緒
  
  // 全域變數
  globals: {
    'NODE_ENV': 'test'
  }
}; 