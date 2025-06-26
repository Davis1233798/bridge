# 通用資料庫同步器 (Universal Database Syncer)

一個支援多種資料庫類型的輪詢式資料同步工具，可以在 MSSQL 和 MariaDB 之間進行雙向資料同步。

## 功能特性

- 🔄 **雙向同步**: 支援任意資料庫類型間的雙向資料同步
- ⏰ **輪詢機制**: 可配置的輪詢間隔，自動檢測資料變更
- 🔌 **萬用相容**: 統一的客戶端/伺服器端配置，支援 MSSQL、MariaDB、MySQL、PostgreSQL
- 🧠 **智慧分析**: 自動分析表格結構，偵測主鍵、索引、更新時間欄位
- 📊 **批次處理**: 高效的批次插入/更新，可配置批次大小
- 🔍 **增量同步**: 基於時間戳的增量同步，只同步變更的資料
- 💾 **狀態追蹤**: 自動維護同步狀態，支援斷點續傳
- 👻 **守護進程**: 內建進程守護功能，支援背景運行和進程管理
- 📝 **結構化日誌**: 完整的日誌記錄，便於問題追蹤和監控
- ⚡ **錯誤恢復**: 內建重試機制和錯誤處理

## 架構設計

```
src/
├── adapters/           # 資料庫適配器
│   ├── BaseAdapter.js     # 基礎適配器抽象類別
│   ├── MSSQLAdapter.js    # MSSQL 適配器
│   ├── MariaDBAdapter.js  # MariaDB 適配器
│   └── AdapterFactory.js  # 適配器工廠
├── config/             # 配置模組
│   └── database.js        # 資料庫配置
├── core/               # 核心邏輯
│   └── SyncJob.js         # 同步任務
├── utils/              # 工具模組
│   └── logger.js          # 日誌模組
└── syncer.js           # 主程式
```

## 安裝與設定

### 1. 初始化專案

```bash
npm run setup
```
此指令會自動：
- 安裝基礎依賴套件 (dotenv, winston)
- 複製 .env.example 到 .env（如果不存在）
- 建立必要目錄 (cache, logs)

### 2. 配置環境變數

編輯 `.env` 檔案，設定資料庫連線資訊。

### 3. 智慧驅動程式管理

```bash
# 根據 .env 配置自動安裝需要的驅動程式
npm run install-drivers

# 檢查驅動程式安裝狀態
npm run check-drivers

# 查看支援的資料庫類型
npm run check-drivers -- --supported
```

**驅動程式管理特色：**
- 🎯 **按需安裝**: 只安裝 .env 中配置的資料庫驅動
- 🗑️ **自動清理**: 移除不需要的驅動程式節省空間
- 🛡️ **避免問題**: 自動使用穩定的驅動程式版本
- 📦 **Oracle 支援**: 使用現代的 `oracledb` 替代有問題的舊版 `oracle`

### 4. 配置說明

```env
# 同步器設定
SYNC_INTERVAL=30000          # 輪詢間隔（毫秒）
UPDATE_COLUMN=updated_at     # 更新時間欄位名稱（程式會自動偵測）
BATCH_SIZE=1000             # 批次處理大小
MAX_RETRY_ATTEMPTS=3        # 最大重試次數

# 客戶端資料庫設定
CLIENT_DB_TYPE=mssql        # 支援: mssql, mariadb, mysql, postgres
CLIENT_DB_HOST=localhost
CLIENT_DB_PORT=1433
CLIENT_DB_USER=your_user
CLIENT_DB_PASSWORD=your_password
CLIENT_DB_DATABASE=your_database

# 伺服器端資料庫設定（雲端）
SERVER_DB_TYPE=mariadb      # 支援: mssql, mariadb, mysql, postgres
SERVER_DB_HOST=your-gcp-host
SERVER_DB_PORT=3306
SERVER_DB_USER=root
SERVER_DB_PASSWORD=your_password
SERVER_DB_DATABASE=your_database

# 客戶端到伺服器端同步設定
CLIENT_TO_SERVER_LISTEN_TABLE=test_polling    # 客戶端監聽的表名
CLIENT_TO_SERVER_SYNC_TABLE=test_syncing      # 同步到伺服器端的表名

# 伺服器端到客戶端同步設定
SERVER_TO_CLIENT_LISTEN_TABLE=test_polling    # 伺服器端監聽的表名
SERVER_TO_CLIENT_SYNC_TABLE=test_syncing      # 同步到客戶端的表名

# 表結構快取設定
SCHEMA_CACHE_ENABLED=true                    # 是否啟用表結構快取
SCHEMA_CACHE_FILE=./cache/table_schemas.json # 表結構快取檔案路徑
SCHEMA_CACHE_TTL=3600000                     # 快取有效期（毫秒，1小時）

# 進程守護設定
DAEMON_MODE=false           # 是否自動以守護進程模式啟動
PID_FILE=./db_syncer.pid   # PID 檔案路徑
```

## 使用方法

### 🚀 啟動同步器

```bash
# 前台運行（適合開發/測試）
npm start

# 背景守護進程運行（適合生產環境）
npm run start:daemon

# 開發環境（自動重啟，檔案變更時重新載入）
npm run dev
```

### 🔧 進程管理

```bash
# 停止守護進程
npm run stop

# 重啟守護進程
npm run restart

# 查看守護進程狀態
npm run status
```

### 📊 狀態監控

```bash
# 查看即時狀態
npm run status

# 查看日誌
tail -f logs/combined.log

# 查看錯誤日誌
tail -f logs/error.log
```

### 表格準備

確保要同步的表格包含以下欄位：

1. **主鍵欄位**: 預設為 `id`
2. **更新時間欄位**: 預設為 `updated_at`，可在環境變數中修改

```sql
-- 範例表格結構
CREATE TABLE example_table (
    id INT PRIMARY KEY IDENTITY(1,1),
    name NVARCHAR(255),
    description NVARCHAR(MAX),
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE()
);

-- 為 updated_at 欄位新增觸發器（MSSQL）
CREATE TRIGGER tr_example_table_updated_at
ON example_table
AFTER UPDATE
AS
BEGIN
    UPDATE example_table 
    SET updated_at = GETDATE() 
    WHERE id IN (SELECT DISTINCT id FROM inserted)
END;
```

## 支援的資料庫

### 目前支援
- ✅ **Microsoft SQL Server**
- ✅ **MariaDB / MySQL**

### 規劃支援
- 🔄 **PostgreSQL**
- 🔄 **SQLite**
- 🔄 **MongoDB**
- 🔄 **Oracle Database**

## 擴展新資料庫類型

1. 建立新的適配器檔案，繼承 `BaseAdapter`：

```javascript
// src/adapters/PostgreSQLAdapter.js
const BaseAdapter = require('./BaseAdapter');

class PostgreSQLAdapter extends BaseAdapter {
  // 實作所有必要的方法
}

module.exports = PostgreSQLAdapter;
```

2. 在 `AdapterFactory.js` 中註冊新適配器：

```javascript
case 'postgres':
case 'postgresql':
  return new PostgreSQLAdapter(config);
```

3. 在 `database.js` 中添加配置：

```javascript
postgres: {
  host: process.env.POSTGRES_HOST,
  // ... 其他配置
}
```

## 監控與日誌

### 日誌檔案

- `logs/combined.log`: 所有日誌
- `logs/error.log`: 僅錯誤日誌

### 日誌級別

- `error`: 錯誤信息
- `warn`: 警告信息
- `info`: 一般信息
- `debug`: 除錯信息

### 設定日誌級別

```env
LOG_LEVEL=info  # error | warn | info | debug
```

## 效能調優

### 批次大小調整

```env
BATCH_SIZE=1000  # 根據資料量和記憶體調整
```

### 輪詢間隔調整

```env
SYNC_INTERVAL=30000  # 根據資料更新頻率調整
```

### 連接池配置

在 `src/config/database.js` 中調整連接池設定：

```javascript
pool: {
  max: 10,        # 最大連接數
  min: 0,         # 最小連接數
  idleTimeoutMillis: 30000  # 閒置超時時間
}
```

## 常見問題

### 1. 連接失敗

檢查網路連接、防火牆設定和資料庫認證資訊。

### 2. 同步慢

- 增加批次大小
- 檢查資料庫索引
- 調整連接池設定

### 3. 記憶體不足

- 減少批次大小
- 增加系統記憶體
- 優化 SQL 查詢

## 授權

MIT License

## 貢獻

歡迎提交 Issue 和 Pull Request 來改善這個專案。 