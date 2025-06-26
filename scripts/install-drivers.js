#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * 資料庫驅動程式映射表
 */
const DB_DRIVERS = {
  mssql: {
    package: 'mssql',
    version: '^10.0.1',
    description: 'Microsoft SQL Server 驅動程式'
  },
  mariadb: {
    package: 'mariadb',
    version: '^3.2.2',
    description: 'MariaDB 驅動程式'
  },
  mysql: {
    package: 'mysql2',
    version: '^3.6.5',
    description: 'MySQL 驅動程式'
  },
  postgres: {
    package: 'pg',
    version: '^8.11.3',
    description: 'PostgreSQL 驅動程式'
  },
  postgresql: {
    package: 'pg',
    version: '^8.11.3',
    description: 'PostgreSQL 驅動程式'
  },
  sqlite: {
    package: 'sqlite3',
    version: '^5.1.6',
    description: 'SQLite 驅動程式'
  },
  sqlite3: {
    package: 'sqlite3',
    version: '^5.1.6',
    description: 'SQLite 驅動程式'
  },
  mongodb: {
    package: 'mongodb',
    version: '^6.3.0',
    description: 'MongoDB 驅動程式'
  },
  oracle: {
    package: 'oracledb',
    version: '^6.3.0',
    description: 'Oracle Database 驅動程式',
    requirements: {
      note: '需要 Oracle Instant Client',
      env: ['OCI_LIB_DIR', 'OCI_INCLUDE_DIR'],
      docs: 'https://oracle.github.io/node-oracledb/INSTALL.html'
    }
  }
};

/**
 * 解析 .env 檔案並取得資料庫類型
 */
function parseEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  
  if (!fs.existsSync(envPath)) {
    console.log('❌ .env 檔案不存在，請先執行 npm run setup');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const dbTypes = new Set();

  // 尋找資料庫類型設定
  const lines = envContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('CLIENT_DB_TYPE=') || trimmed.startsWith('SERVER_DB_TYPE=')) {
      const [, value] = trimmed.split('=');
      if (value && value.trim()) {
        dbTypes.add(value.trim().toLowerCase());
      }
    }
  }

  return Array.from(dbTypes);
}

/**
 * 檢查套件是否已安裝
 */
function isPackageInstalled(packageName) {
  try {
    require.resolve(packageName);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * 安裝套件
 */
function installPackage(packageName, version, description) {
  console.log(`📦 安裝 ${description} (${packageName}@${version})...`);
  
  try {
    execSync(`npm install ${packageName}@${version}`, { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    console.log(`✅ ${description} 安裝成功`);
    return true;
  } catch (error) {
    console.error(`❌ ${description} 安裝失敗:`, error.message);
    return false;
  }
}

/**
 * 移除不需要的套件
 */
function removePackage(packageName, description) {
  console.log(`🗑️  移除不需要的 ${description} (${packageName})...`);
  
  try {
    execSync(`npm uninstall ${packageName}`, { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    console.log(`✅ ${description} 移除成功`);
    return true;
  } catch (error) {
    console.error(`❌ ${description} 移除失敗:`, error.message);
    return false;
  }
}

/**
 * 主要執行函數
 */
function main() {
  console.log('🔍 分析 .env 配置中的資料庫類型...\n');

  // 解析 .env 檔案
  const requiredDbTypes = parseEnvFile();
  
  if (requiredDbTypes.length === 0) {
    console.log('❌ 未找到資料庫類型設定，請檢查 .env 檔案中的 CLIENT_DB_TYPE 和 SERVER_DB_TYPE');
    process.exit(1);
  }

  console.log('📋 需要的資料庫類型:', requiredDbTypes.join(', '));
  console.log();

  // 收集需要安裝的驅動程式
  const requiredDrivers = new Set();
  const unknownTypes = [];

  for (const dbType of requiredDbTypes) {
    if (DB_DRIVERS[dbType]) {
      requiredDrivers.add(DB_DRIVERS[dbType].package);
    } else {
      unknownTypes.push(dbType);
    }
  }

  if (unknownTypes.length > 0) {
    console.log('⚠️  未知的資料庫類型:', unknownTypes.join(', '));
    console.log('支援的類型:', Object.keys(DB_DRIVERS).join(', '));
    console.log();
  }

  // 安裝需要的驅動程式
  let installSuccess = 0;
  let installFailed = 0;

  for (const dbType of requiredDbTypes) {
    const driver = DB_DRIVERS[dbType];
    if (!driver) continue;

    if (isPackageInstalled(driver.package)) {
      console.log(`✅ ${driver.description} 已安裝`);
      continue;
    }

    // 特殊處理 Oracle
    if (dbType === 'oracle') {
      console.log(`⚠️  ${driver.description} 需要額外設定:`);
      console.log(`   📖 文件: ${driver.requirements.docs}`);
      console.log(`   🔧 環境變數: ${driver.requirements.env.join(', ')}`);
      console.log(`   💡 ${driver.requirements.note}`);
      console.log();
    }

    if (installPackage(driver.package, driver.version, driver.description)) {
      installSuccess++;
    } else {
      installFailed++;
    }
  }

  // 移除不需要的驅動程式
  const allDriverPackages = new Set(Object.values(DB_DRIVERS).map(d => d.package));
  let removeSuccess = 0;

  for (const [packageName, driver] of Object.entries(DB_DRIVERS).map(([type, driver]) => [driver.package, driver])) {
    if (!requiredDrivers.has(packageName) && isPackageInstalled(packageName)) {
      if (removePackage(packageName, driver.description)) {
        removeSuccess++;
      }
    }
  }

  // 總結
  console.log('\n📊 安裝總結:');
  console.log(`✅ 成功安裝: ${installSuccess} 個驅動程式`);
  if (installFailed > 0) {
    console.log(`❌ 安裝失敗: ${installFailed} 個驅動程式`);
  }
  if (removeSuccess > 0) {
    console.log(`🗑️  成功移除: ${removeSuccess} 個不需要的驅動程式`);
  }

  if (installFailed === 0) {
    console.log('\n🎉 所有需要的資料庫驅動程式已準備就緒！');
  } else {
    console.log('\n⚠️  部分驅動程式安裝失敗，請檢查錯誤訊息並手動安裝');
    process.exit(1);
  }
}

// 執行主函數
if (require.main === module) {
  main();
}

module.exports = { DB_DRIVERS, parseEnvFile, isPackageInstalled }; 