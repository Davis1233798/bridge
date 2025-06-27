# MSSQL Named Pipe 連線設定指南

本文件說明如何配置 MSSQL 資料庫使用 Named Pipe 連線方式。

## 什麼是 Named Pipe？

Named Pipe 是 Windows 系統中的一種進程間通訊 (IPC) 機制，通常用於本機或高性能局域網連線。相比傳統的 TCP/IP 連線，Named Pipe 具有以下優勢：

- **更高的性能**：減少網路堆疊開銷
- **更低的延遲**：直接透過系統管道通訊
- **更好的安全性**：使用 Windows 安全模型

## 設定步驟

### 1. 啟用 SQL Server Named Pipe

首先需要在 SQL Server 上啟用 Named Pipe 協議：

1. 開啟 **SQL Server Configuration Manager**
2. 展開 **SQL Server Network Configuration**
3. 點選 **Protocols for [您的實例名稱]**
4. 右鍵點選 **Named Pipes** → **Enable**
5. 重新啟動 SQL Server 服務

### 2. 配置環境變數

在 `.env` 檔案中設定以下變數：

```bash
# 啟用 Named Pipe 連線
CLIENT_DB_USE_NAMED_PIPE=true

# Named Pipe 路徑設定
CLIENT_DB_NAMED_PIPE_PATH=\\.\pipe\sql\query

# 或者指定遠端伺服器
# CLIENT_DB_NAMED_PIPE_PATH=\\ServerName\pipe\sql\query

# 其他必要設定
CLIENT_DB_TYPE=mssql
CLIENT_DB_USER=your_username
CLIENT_DB_PASSWORD=your_password
CLIENT_DB_DATABASE=your_database
```

### 3. Named Pipe 路徑格式

常見的 Named Pipe 路徑格式：

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

## 範例配置

### 範例 1：本機連線

```bash
CLIENT_DB_TYPE=mssql
CLIENT_DB_USE_NAMED_PIPE=true
CLIENT_DB_NAMED_PIPE_PATH=\\.\pipe\sql\query
CLIENT_DB_USER=sa
CLIENT_DB_PASSWORD=YourPassword
CLIENT_DB_DATABASE=YourDatabase
CLIENT_DB_ENCRYPT=false
CLIENT_DB_TRUST_SERVER_CERTIFICATE=true
```

### 範例 2：遠端伺服器連線

```bash
CLIENT_DB_TYPE=mssql
CLIENT_DB_USE_NAMED_PIPE=true
CLIENT_DB_NAMED_PIPE_PATH=\\192.168.1.100\pipe\sql\query
CLIENT_DB_USER=domain\username
CLIENT_DB_PASSWORD=YourPassword
CLIENT_DB_DATABASE=YourDatabase
CLIENT_DB_ENCRYPT=false
CLIENT_DB_TRUST_SERVER_CERTIFICATE=true
```

### 範例 3：命名實例連線

```bash
CLIENT_DB_TYPE=mssql
CLIENT_DB_USE_NAMED_PIPE=true
CLIENT_DB_NAMED_PIPE_PATH=\\.\pipe\MSSQL$SQLEXPRESS\sql\query
CLIENT_DB_USER=sa
CLIENT_DB_PASSWORD=YourPassword
CLIENT_DB_DATABASE=YourDatabase
```

## 連線測試

使用以下命令測試 Named Pipe 連線：

```bash
# 檢查連線狀態
npm run check:connection

# 持續監控連線
npm run monitor:connection
```

## 切換連線方式

如需從 Named Pipe 切換回 TCP/IP 連線，只需：

```bash
# 停用 Named Pipe
CLIENT_DB_USE_NAMED_PIPE=false

# 設定 TCP/IP 參數
CLIENT_DB_HOST=your_server_ip
CLIENT_DB_PORT=1433
CLIENT_DB_ENCRYPT=true
```

## 故障排除

### 常見問題

1. **連線被拒絕**
   - 檢查 SQL Server 是否啟用 Named Pipe 協議
   - 確認 SQL Server 服務正在運行
   - 驗證 Named Pipe 路徑是否正確

2. **權限問題**
   - 確保帳戶有足夠權限存取 Named Pipe
   - 檢查 SQL Server 登入設定

3. **路徑錯誤**
   - 使用 `\\.\pipe\sql\query` 作為預設實例
   - 對於命名實例使用 `\\.\pipe\MSSQL$實例名稱\sql\query`

### 偵錯技巧

開啟偵錯日誌來查看詳細連線資訊：

```bash
LOG_LEVEL=debug
NODE_ENV=development
```

檢查日誌檔案：
- `logs/connection-YYYY-MM-DD.log` - 連線日誌
- `logs/error-YYYY-MM-DD.log` - 錯誤日誌

## 性能建議

1. **本機連線**：Named Pipe 通常比 TCP/IP 快 10-30%
2. **遠端連線**：在高速局域網環境下效果明顯
3. **連線池**：適當設定連線池大小以獲得最佳性能

```bash
CLIENT_DB_POOL_MAX=10
CLIENT_DB_POOL_MIN=2
CLIENT_DB_POOL_IDLE_TIMEOUT=30000
```

## 注意事項

- Named Pipe 主要適用於 Windows 環境
- Linux 環境建議使用 TCP/IP 連線
- 某些雲端環境可能不支援 Named Pipe
- 防火牆設定對 Named Pipe 影響較小 