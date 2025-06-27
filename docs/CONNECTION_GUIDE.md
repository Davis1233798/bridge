# 資料庫連線指南

本文件說明如何配置和測試不同類型的資料庫連線。

## 支援的連線方式

### MSSQL 連線

#### 1. TCP/IP 連線 (預設)
適用於大多數情況，包括遠端伺服器連線。

```bash
CLIENT_DB_TYPE=mssql
CLIENT_DB_HOST=your_server_ip
CLIENT_DB_PORT=1433
CLIENT_DB_USER=your_username
CLIENT_DB_PASSWORD=your_password
CLIENT_DB_DATABASE=your_database
CLIENT_DB_ENCRYPT=true
CLIENT_DB_TRUST_SERVER_CERTIFICATE=true
```

#### 2. Named Pipe 連線
適用於本機連線或高性能局域網環境。

```bash
CLIENT_DB_TYPE=mssql
CLIENT_DB_USE_NAMED_PIPE=true
CLIENT_DB_NAMED_PIPE_PATH=\\.\pipe\sql\query
CLIENT_DB_USER=your_username
CLIENT_DB_PASSWORD=your_password
CLIENT_DB_DATABASE=your_database
CLIENT_DB_ENCRYPT=false
CLIENT_DB_TRUST_SERVER_CERTIFICATE=true
```

### MariaDB/MySQL 連線

```bash
SERVER_DB_TYPE=mariadb
SERVER_DB_HOST=your_server_ip
SERVER_DB_PORT=3306
SERVER_DB_USER=your_username
SERVER_DB_PASSWORD=your_password
SERVER_DB_DATABASE=your_database
```

## 連線測試

### 基本連線檢查

```bash
# 檢查所有資料庫連線狀態
npm run check:connection

# 持續監控連線狀態
npm run monitor:connection
```

### MSSQL Named Pipe 測試

```bash
# 測試不同 MSSQL 連線方式的性能
npm run test:namedpipe
```

這個測試會同時嘗試：
- TCP/IP 連線
- Named Pipe 連線 (本機預設實例)
- Named Pipe 連線 (自訂路徑)

並提供性能比較結果。

## 常見連線路徑

### Named Pipe 路徑格式

```bash
# 本機預設實例
\\.\pipe\sql\query

# 本機命名實例
\\.\pipe\MSSQL$INSTANCENAME\sql\query

# 遠端伺服器預設實例
\\ServerName\pipe\sql\query

# 遠端伺服器命名實例
\\ServerName\pipe\MSSQL$INSTANCENAME\sql\query
```

## 故障排除

### 1. 連線超時

如果看到連線在某個時間點停止回應，檢查：
- 防火牆設定
- 網路連通性
- 資料庫服務狀態

### 2. Named Pipe 連線失敗

常見原因：
- SQL Server 未啟用 Named Pipe 協議
- Named Pipe 路徑錯誤
- 權限不足

### 3. 日誌檢查

檢查按日期分類的日誌檔案：
- `logs/connection-YYYY-MM-DD.log` - 連線日誌
- `logs/error-YYYY-MM-DD.log` - 錯誤日誌
- `logs/combined-YYYY-MM-DD.log` - 所有日誌

## 性能優化建議

### Named Pipe vs TCP/IP

- **本機連線**: Named Pipe 通常快 10-30%
- **遠端連線**: 在高速網路環境下差異較小
- **防火牆**: Named Pipe 較不受防火牆影響

### 連線池設定

```bash
# MSSQL 連線池
CLIENT_DB_POOL_MAX=10
CLIENT_DB_POOL_MIN=2
CLIENT_DB_POOL_IDLE_TIMEOUT=30000

# MariaDB 連線池  
MYSQL_CONNECTION_LIMIT=10
MYSQL_ACQUIRE_TIMEOUT=60000
MYSQL_TIMEOUT=60000
```

## 範例配置檔案

參考 `.env.example` 檔案中的完整配置範例。

詳細的 Named Pipe 設定請參考 [NAMED_PIPE_SETUP.md](./NAMED_PIPE_SETUP.md)。 