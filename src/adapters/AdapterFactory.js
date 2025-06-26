const MSSQLAdapter = require('./MSSQLAdapter');
const MariaDBAdapter = require('./MariaDBAdapter');

/**
 * 資料庫適配器工廠
 * 根據資料庫類型和配置創建對應的適配器實例
 */
class AdapterFactory {
  /**
   * 創建資料庫適配器
   * @param {string} type - 資料庫類型 (mssql, mariadb, postgres, etc.)
   * @param {Object} config - 資料庫連接配置
   * @returns {BaseAdapter} 對應的資料庫適配器實例
   */
  static createAdapter(type, config) {
    switch (type.toLowerCase()) {
      case 'mssql':
        return new MSSQLAdapter(config);
      
      case 'mariadb':
      case 'mysql':
        return new MariaDBAdapter(config);
      
      case 'gcp_mariadb':
        return new MariaDBAdapter(config);
      
      case 'client_mariadb':
        return new MariaDBAdapter(config);
        
      // 預留給未來資料庫類型
      case 'postgres':
      case 'postgresql':
        // TODO: 實作 PostgreSQLAdapter
        throw new Error('PostgreSQL adapter not implemented yet');
      
      case 'sqlite':
        // TODO: 實作 SQLiteAdapter
        throw new Error('SQLite adapter not implemented yet');
      
      case 'mongodb':
      case 'mongo':
        // TODO: 實作 MongoDBAdapter
        throw new Error('MongoDB adapter not implemented yet');
      
      case 'oracle':
        // TODO: 實作 OracleAdapter
        throw new Error('Oracle adapter not implemented yet');
      
      default:
        throw new Error(`不支援的資料庫類型: ${type}`);
    }
  }

  /**
   * 取得支援的資料庫類型列表
   * @returns {Array} 支援的資料庫類型
   */
  static getSupportedTypes() {
    return [
      'mssql',
      'mariadb',
      'mysql',
      'gcp_mariadb',
      'client_mariadb',
      // 預留類型
      'postgres',
      'postgresql',
      'sqlite',
      'mongodb',
      'mongo',
      'oracle'
    ];
  }

  /**
   * 檢查是否支援指定的資料庫類型
   * @param {string} type - 資料庫類型
   * @returns {boolean} 是否支援
   */
  static isSupported(type) {
    return this.getSupportedTypes().includes(type.toLowerCase());
  }
}

module.exports = AdapterFactory; 