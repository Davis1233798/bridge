require('dotenv').config();

/**
 * 通用資料庫配置建構器
 * 根據資料庫類型建立對應的連接配置
 */
function buildDbConfig(type, prefix) {
  const config = {
    type: type.toLowerCase(),
    host: process.env[`${prefix}_DB_HOST`],
    port: parseInt(process.env[`${prefix}_DB_PORT`]),
    user: process.env[`${prefix}_DB_USER`],
    password: process.env[`${prefix}_DB_PASSWORD`],
    database: process.env[`${prefix}_DB_DATABASE`]
  };

  // 根據資料庫類型添加特定配置
  switch (type.toLowerCase()) {
    case 'mssql':
      return {
        ...config,
        server: config.host, // MSSQL 使用 server 而不是 host
        options: {
          encrypt: process.env.MSSQL_ENCRYPT === 'true' || true,
          trustServerCertificate: process.env.MSSQL_TRUST_SERVER_CERTIFICATE === 'true' || true,
        },
        pool: {
          max: parseInt(process.env.MSSQL_POOL_MAX) || 10,
          min: parseInt(process.env.MSSQL_POOL_MIN) || 0,
          idleTimeoutMillis: parseInt(process.env.MSSQL_POOL_IDLE_TIMEOUT) || 30000
        },
        connectionTimeout: parseInt(process.env.MSSQL_CONNECTION_TIMEOUT) || 30000,
        requestTimeout: parseInt(process.env.MSSQL_REQUEST_TIMEOUT) || 30000
      };

    case 'mariadb':
    case 'mysql':
      return {
        ...config,
        connectionLimit: parseInt(process.env.MYSQL_CONNECTION_LIMIT) || 10,
        acquireTimeout: parseInt(process.env.MYSQL_ACQUIRE_TIMEOUT) || 60000,
        timeout: parseInt(process.env.MYSQL_TIMEOUT) || 60000,
        reconnect: process.env.MYSQL_RECONNECT === 'true' || true,
        charset: process.env.MYSQL_CHARSET || 'utf8mb4',
        timezone: process.env.MYSQL_TIMEZONE || 'local'
      };

    case 'postgres':
    case 'postgresql':
      return {
        ...config,
        max: parseInt(process.env.POSTGRES_MAX_CONNECTIONS) || 10,
        idleTimeoutMillis: parseInt(process.env.POSTGRES_IDLE_TIMEOUT) || 30000,
        connectionTimeoutMillis: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT) || 2000,
        ssl: process.env.POSTGRES_SSL === 'true' || false
      };

    default:
      return config;
  }
}

/**
 * 資料庫配置
 */
const dbConfig = {
  client: buildDbConfig(process.env.CLIENT_DB_TYPE || 'mariadb', 'CLIENT'),
  server: buildDbConfig(process.env.SERVER_DB_TYPE || 'mariadb', 'SERVER')
};

/**
 * 同步器設定
 */
const syncConfig = {
  interval: parseInt(process.env.SYNC_INTERVAL) || 30000,
  updateColumn: process.env.UPDATE_COLUMN || 'updated_at',
  batchSize: parseInt(process.env.BATCH_SIZE) || 1000,
  maxRetryAttempts: parseInt(process.env.MAX_RETRY_ATTEMPTS) || 3,
  
  // 同步表格配置 - 明確區分監聽表和同步表
  tables: {
    clientToServer: {
      listenTable: process.env.CLIENT_TO_SERVER_LISTEN_TABLE?.trim() || '',
      syncTable: process.env.CLIENT_TO_SERVER_SYNC_TABLE?.trim() || ''
    },
    serverToClient: {
      listenTable: process.env.SERVER_TO_CLIENT_LISTEN_TABLE?.trim() || '',
      syncTable: process.env.SERVER_TO_CLIENT_SYNC_TABLE?.trim() || ''
    }
  },

  // 守護進程配置
  daemon: {
    enabled: process.env.DAEMON_MODE === 'true',
    pidFile: process.env.PID_FILE || './db_syncer.pid'
  },

  // 表結構快取配置
  schemaCache: {
    enabled: process.env.SCHEMA_CACHE_ENABLED === 'true' || true,
    filePath: process.env.SCHEMA_CACHE_FILE || './cache/table_schemas.json',
    ttl: parseInt(process.env.SCHEMA_CACHE_TTL) || 3600000 // 1小時
  }
};

/**
 * 驗證配置
 */
function validateConfig() {
  const errors = [];

  // 檢查客戶端資料庫配置
  if (!dbConfig.client.host) {
    errors.push('CLIENT_DB_HOST 未設定');
  }
  if (!dbConfig.client.database) {
    errors.push('CLIENT_DB_DATABASE 未設定');
  }

  // 檢查伺服器端資料庫配置
  if (!dbConfig.server.host) {
    errors.push('SERVER_DB_HOST 未設定');
  }
  if (!dbConfig.server.database) {
    errors.push('SERVER_DB_DATABASE 未設定');
  }

  // 檢查同步表格設定
  const { clientToServer, serverToClient } = syncConfig.tables;
  
  const hasClientToServerSync = clientToServer.listenTable && clientToServer.syncTable;
  const hasServerToClientSync = serverToClient.listenTable && serverToClient.syncTable;
  
  if (!hasClientToServerSync && !hasServerToClientSync) {
    errors.push('至少需要設定一組同步表格 (CLIENT_TO_SERVER 或 SERVER_TO_CLIENT)');
  }

  // 檢查表格配對
  if (clientToServer.listenTable && !clientToServer.syncTable) {
    errors.push('CLIENT_TO_SERVER_LISTEN_TABLE 已設定，但缺少 CLIENT_TO_SERVER_SYNC_TABLE');
  }
  if (clientToServer.syncTable && !clientToServer.listenTable) {
    errors.push('CLIENT_TO_SERVER_SYNC_TABLE 已設定，但缺少 CLIENT_TO_SERVER_LISTEN_TABLE');
  }
  if (serverToClient.listenTable && !serverToClient.syncTable) {
    errors.push('SERVER_TO_CLIENT_LISTEN_TABLE 已設定，但缺少 SERVER_TO_CLIENT_SYNC_TABLE');
  }
  if (serverToClient.syncTable && !serverToClient.listenTable) {
    errors.push('SERVER_TO_CLIENT_SYNC_TABLE 已設定，但缺少 SERVER_TO_CLIENT_LISTEN_TABLE');
  }

  if (errors.length > 0) {
    throw new Error(`配置驗證失敗:\n${errors.join('\n')}`);
  }

  return true;
}

module.exports = { dbConfig, syncConfig, validateConfig }; 