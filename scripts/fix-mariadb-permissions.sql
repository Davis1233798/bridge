-- 建立測試資料庫
CREATE DATABASE IF NOT EXISTS test;

-- 使用測試資料庫
USE test;

-- 修復 root 使用者權限，允許從任何主機連接
UPDATE mysql.user SET Host='%' WHERE User='root' AND Host='localhost';

-- 如果不存在，建立一個新的 root 使用者允許遠端連接
CREATE USER IF NOT EXISTS 'root'@'%' IDENTIFIED BY 'root';

-- 授予所有權限
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;

-- 重新載入權限表
FLUSH PRIVILEGES;

-- 顯示當前使用者
SELECT User, Host, plugin FROM mysql.user WHERE User='root';

-- 建立測試表格
CREATE TABLE IF NOT EXISTS test_polling (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  age INT,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_updated_at (updated_at),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS test_syncing (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  age INT,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_updated_at (updated_at),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 顯示表格
SHOW TABLES; 