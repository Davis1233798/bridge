#!/usr/bin/env node

const { DB_DRIVERS, parseEnvFile, isPackageInstalled } = require('./install-drivers');

/**
 * 取得套件版本
 */
function getPackageVersion(packageName) {
  try {
    const packagePath = require.resolve(`${packageName}/package.json`);
    const packageJson = require(packagePath);
    return packageJson.version;
  } catch (error) {
    return '未知';
  }
}

/**
 * 檢查驅動程式狀態
 */
function checkDriverStatus() {
  console.log('🔍 檢查資料庫驅動程式狀態...\n');

  // 解析 .env 檔案
  let requiredDbTypes = [];
  try {
    requiredDbTypes = parseEnvFile();
  } catch (error) {
    console.log('⚠️  無法讀取 .env 檔案，顯示所有驅動程式狀態\n');
  }

  console.log('📋 需要的資料庫類型:', requiredDbTypes.length > 0 ? requiredDbTypes.join(', ') : '無法確定');
  console.log();

  // 檢查所有驅動程式
  const results = {
    required: { installed: 0, missing: 0 },
    optional: { installed: 0, unnecessary: 0 }
  };

  console.log('📦 驅動程式狀態:');
  console.log(''.padEnd(60, '─'));

  for (const [dbType, driver] of Object.entries(DB_DRIVERS)) {
    const isRequired = requiredDbTypes.includes(dbType);
    const isInstalled = isPackageInstalled(driver.package);
    const version = isInstalled ? getPackageVersion(driver.package) : '';

    let status = '';
    let icon = '';

    if (isRequired && isInstalled) {
      status = '✅ 已安裝 (必需)';
      icon = '✅';
      results.required.installed++;
    } else if (isRequired && !isInstalled) {
      status = '❌ 缺少 (必需)';
      icon = '❌';
      results.required.missing++;
    } else if (!isRequired && isInstalled) {
      status = '🔄 已安裝 (非必需)';
      icon = '🔄';
      results.optional.unnecessary++;
    } else {
      status = '⚪ 未安裝 (非必需)';
      icon = '⚪';
    }

    const versionText = version ? ` v${version}` : '';
    console.log(`${icon} ${driver.description.padEnd(25)} ${status}${versionText}`);
    
    // 特殊提示
    if (dbType === 'oracle' && isRequired) {
      console.log(`   💡 需要 Oracle Instant Client: ${driver.requirements.docs}`);
    }
  }

  console.log(''.padEnd(60, '─'));

  // 總結
  console.log('\n📊 總結:');
  if (requiredDbTypes.length > 0) {
    console.log(`✅ 必需驅動程式: ${results.required.installed}/${results.required.installed + results.required.missing} 已安裝`);
    if (results.required.missing > 0) {
      console.log(`❌ 缺少 ${results.required.missing} 個必需的驅動程式`);
    }
    if (results.optional.unnecessary > 0) {
      console.log(`🔄 ${results.optional.unnecessary} 個非必需的驅動程式已安裝`);
    }
  } else {
    console.log(`📦 總共 ${Object.keys(DB_DRIVERS).length} 個支援的驅動程式`);
    const totalInstalled = Object.values(DB_DRIVERS).filter(d => isPackageInstalled(d.package)).length;
    console.log(`✅ 已安裝: ${totalInstalled} 個`);
  }

  // 建議
  console.log('\n💡 建議:');
  if (results.required.missing > 0) {
    console.log('📦 執行 npm run install-drivers 安裝缺少的驅動程式');
  } else if (requiredDbTypes.length > 0) {
    console.log('🎉 所有必需的驅動程式都已安裝！');
  }
  
  if (results.optional.unnecessary > 0) {
    console.log('🗑️  執行 npm run install-drivers 移除不需要的驅動程式以節省空間');
  }

  return results.required.missing === 0;
}

/**
 * 顯示支援的資料庫類型
 */
function showSupportedDatabases() {
  console.log('\n🗄️  支援的資料庫類型:');
  console.log(''.padEnd(50, '─'));
  
  for (const [dbType, driver] of Object.entries(DB_DRIVERS)) {
    console.log(`• ${dbType.padEnd(12)} → ${driver.description}`);
  }
  
  console.log('\n📝 在 .env 檔案中設定 CLIENT_DB_TYPE 和 SERVER_DB_TYPE');
}

/**
 * 主要執行函數
 */
function main() {
  // npm run 會將 -- 後的參數傳遞，需要檢查所有參數
  const allArgs = process.argv.slice(2);
  const npmArgs = process.env.npm_config_argv ? JSON.parse(process.env.npm_config_argv).original : [];
  const args = [...allArgs, ...npmArgs];
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log('🔍 資料庫驅動程式檢查工具\n');
    console.log('用法:');
    console.log('  npm run check-drivers              檢查驅動程式狀態');
    console.log('  npm run check-drivers -- --supported  顯示支援的資料庫類型');
    console.log('  npm run check-drivers -- --help       顯示此說明\n');
    return;
  }
  
  if (args.includes('--supported')) {
    showSupportedDatabases();
    return;
  }
  
  const allReady = checkDriverStatus();
  
  if (!allReady) {
    process.exit(1);
  }
}

// 執行主函數
if (require.main === module) {
  main();
} 