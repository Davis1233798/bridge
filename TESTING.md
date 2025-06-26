# 資料庫同步器測試指南

## 測試概覽

本專案提供完整的 test_polling 表格 CRUD 操作測試和單元測試框架。

## 快速開始

### 1. 安裝依賴
```bash
npm install
npm run install-drivers
```

### 2. 配置環境變數
確保 `.env` 檔案包含正確的資料庫連接資訊：
```bash
# 客戶端資料庫（MSSQL）
CLIENT_DB_TYPE=mssql
CLIENT_DB_HOST=100.80.140.65
CLIENT_DB_PORT=1433
CLIENT_DB_USER=efast
CLIENT_DB_PASSWORD=a126182900
CLIENT_DB_DATABASE=TEST1

# 伺服器端資料庫（MariaDB）
SERVER_DB_TYPE=mariadb
SERVER_DB_HOST=localhost
SERVER_DB_PORT=3306
SERVER_DB_USER=root
SERVER_DB_PASSWORD=root
SERVER_DB_DATABASE=test

# 監聽表格
CLIENT_TO_SERVER_LISTEN_TABLE=test_polling
SERVER_TO_CLIENT_LISTEN_TABLE=test_polling
```

## 測試方法

### 方法 1: 互動式測試工具
```bash
npm run test:interactive
```
這會啟動一個互動式選單，讓您選擇不同的測試選項。

### 方法 2: 直接執行 CRUD 測試
```bash
npm run test:crud
```
執行完整的 test_polling 表格 CRUD 操作測試。

### 方法 3: Jest 單元測試
```bash
# 執行所有單元測試
npm test

# 執行測試並產生覆蓋率報告
npm run test:coverage

# 監控模式（自動重新執行測試）
npm run test:watch
```

## 測試功能

### CRUD 操作測試 (`tests/crud-operations.js`)

1. **建立表格** - 在 MSSQL 和 MariaDB 建立 test_polling 表格
2. **插入資料** - 插入5筆測試資料到客戶端，3筆到伺服器端
3. **查詢資料** - 從兩個資料庫查詢所有資料
4. **更新資料** - 更新第一筆記錄的年齡和狀態
5. **刪除資料** - 刪除最後一筆記錄
6. **同步查詢** - 測試同步功能相關的查詢

### 單元測試 (`tests/test_polling.test.js`)

使用 Jest 框架進行的完整單元測試，包括：
- 表格建立測試
- 資料插入測試
- 資料查詢測試
- 資料更新測試
- 資料刪除測試
- 同步查詢測試
- 完整流程測試

## test_polling 表格結構

### MSSQL 版本
```sql
CREATE TABLE test_polling (
  id int IDENTITY(1,1) PRIMARY KEY,
  name NVARCHAR(255) NOT NULL,
  email NVARCHAR(255),
  age INT,
  status NVARCHAR(50) DEFAULT 'active',
  created_at DATETIME2 DEFAULT GETDATE(),
  updated_at DATETIME2 DEFAULT GETDATE()
);
```

### MariaDB 版本
```sql
CREATE TABLE test_polling (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  age INT,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_updated_at (updated_at),
  INDEX idx_status (status)
);
```

## CI/CD 自動測試

### GitHub Actions
專案包含 GitHub Actions 工作流程 (`.github/workflows/test.yml`)，會在：
- 推送到 main 或 develop 分支時
- 建立 Pull Request 時

自動執行所有測試。

### 本地 CI 模擬
您可以使用 Docker 在本地模擬 CI 環境：
```bash
# 啟動 MariaDB 容器
docker run -d --name test-mariadb \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=test \
  -p 3306:3306 \
  mariadb:10.9

# 等待資料庫準備就緒
sleep 30

# 執行測試
npm run test:crud
npm run test:coverage
```

## 測試資料清理

測試完成後會自動清理測試資料，但您也可以手動清理：
```javascript
const TestPollingCRUD = require('./tests/crud-operations');
const crud = new TestPollingCRUD();

async function cleanup() {
  await crud.initialize();
  await crud.cleanup();
  await crud.close();
}

cleanup();
```

## 故障排除

### 連接問題
1. 檢查資料庫服務是否正在運行
2. 驗證 `.env` 檔案中的連接資訊
3. 確認防火牆設定允許連接

### 權限問題
確保資料庫使用者有以下權限：
- CREATE TABLE
- INSERT, SELECT, UPDATE, DELETE
- CREATE TRIGGER (MSSQL)

### 依賴問題
```bash
# 重新安裝依賴
rm -rf node_modules package-lock.json
npm install
npm run install-drivers
```

## 測試報告

測試完成後會產生：
- 日誌檔案：`logs/combined.log`、`logs/error.log`
- 覆蓋率報告：`coverage/` 目錄
- Jest 測試結果：終端輸出

## 效能測試

如需進行效能測試，可以修改 `tests/crud-operations.js` 中的測試資料數量：
```javascript
// 產生大量測試資料進行效能測試
const testData = Array.from({ length: 10000 }, (_, i) => ({
  name: `測試使用者${i}`,
  email: `user${i}@example.com`,
  age: 20 + (i % 50)
}));
``` 