const winston = require('winston');
const path = require('path');

/**
 * 日誌配置
 */
const logLevel = process.env.LOG_LEVEL || 'info';

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
    
    // 錯誤日誌檔案
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // 所有日誌檔案
    new winston.transports.File({
      filename: path.join('logs', 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 10
    })
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

module.exports = { logger, syncLogger }; 