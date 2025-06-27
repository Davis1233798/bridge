const winston = require('winston');
const path = require('path');
require('winston-daily-rotate-file');

/**
 * 日誌配置
 */
const logLevel = process.env.LOG_LEVEL || 'info';

// 建立日期格式的檔名
const createDailyRotateTransport = (filename, level = null) => {
  return new winston.transports.DailyRotateFile({
    filename: path.join('logs', `${filename}-%DATE%.log`),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d', // 保留14天
    level: level,
    format: winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      winston.format.json()
    )
  });
};

const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'db-syncer' },
  transports: [
    // 控制台輸出
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          let log = `${timestamp} [${level}]: ${message}`;
          if (Object.keys(meta).length > 0) {
            log += ` ${JSON.stringify(meta)}`;
          }
          return log;
        })
      )
    }),
    
    // 錯誤日誌檔案 (依日期分開)
    createDailyRotateTransport('error', 'error'),
    
    // 所有日誌檔案 (依日期分開)
    createDailyRotateTransport('combined'),
    
    // 連線日誌檔案 (依日期分開)
    createDailyRotateTransport('connection'),
    
    // 同步日誌檔案 (依日期分開)
    createDailyRotateTransport('sync')
  ]
});

/**
 * 如果是開發環境，增加詳細的日誌
 */
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

/**
 * 連線專用的日誌方法
 */
const connectionLogger = {
  info: (message, meta = {}) => logger.info(message, { ...meta, category: 'connection' }),
  error: (message, meta = {}) => logger.error(message, { ...meta, category: 'connection' }),
  warn: (message, meta = {}) => logger.warn(message, { ...meta, category: 'connection' }),
  debug: (message, meta = {}) => logger.debug(message, { ...meta, category: 'connection' }),
  
  // 連線成功
  connectionSuccess: (dbType, config) => {
    logger.info('資料庫連線成功', {
      category: 'connection',
      dbType,
      host: config.host,
      database: config.database,
      timestamp: new Date().toISOString()
    });
  },
  
  // 連線失敗
  connectionError: (dbType, config, error) => {
    logger.error('資料庫連線失敗', {
      category: 'connection',
      dbType,
      host: config.host,
      database: config.database,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  },
  
  // 連線斷開
  disconnection: (dbType, config) => {
    logger.info('資料庫連線已斷開', {
      category: 'connection',
      dbType,
      host: config.host,
      database: config.database,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * 同步專用的日誌方法
 */
const syncLogger = {
  info: (message, meta = {}) => logger.info(message, { ...meta, category: 'sync' }),
  error: (message, meta = {}) => logger.error(message, { ...meta, category: 'sync' }),
  warn: (message, meta = {}) => logger.warn(message, { ...meta, category: 'sync' }),
  debug: (message, meta = {}) => logger.debug(message, { ...meta, category: 'sync' }),
  
  // 同步開始
  syncStart: (tableName, source, target) => {
    logger.info('同步開始', {
      category: 'sync',
      table: tableName,
      source,
      target,
      timestamp: new Date().toISOString()
    });
  },
  
  // 同步完成
  syncComplete: (tableName, results) => {
    logger.info('同步完成', {
      category: 'sync',
      table: tableName,
      ...results,
      timestamp: new Date().toISOString()
    });
  },
  
  // 同步錯誤
  syncError: (tableName, error) => {
    logger.error('同步錯誤', {
      category: 'sync',
      table: tableName,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = { logger, syncLogger, connectionLogger }; 