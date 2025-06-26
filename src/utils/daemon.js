const fs = require('fs').promises;
const path = require('path');
const { logger } = require('./logger');

/**
 * 進程守護工具
 */
class DaemonManager {
  constructor(pidFile) {
    this.pidFile = pidFile || './db_syncer.pid';
  }

  /**
   * 啟動守護進程
   */
  async startDaemon() {
    try {
      // 檢查是否已有進程在運行
      if (await this.isRunning()) {
        throw new Error('同步器已經在運行中');
      }

      // 建立守護進程
      this.daemonize();
      
      // 寫入 PID 檔案
      await this.writePidFile();
      
      // 設定清理處理器
      this.setupCleanupHandlers();
      
      logger.info(`守護進程啟動成功，PID: ${process.pid}`);
      
    } catch (error) {
      logger.error('啟動守護進程失敗:', error);
      throw error;
    }
  }

  /**
   * 停止守護進程
   */
  async stopDaemon() {
    try {
      const pid = await this.readPidFile();
      
      if (!pid) {
        logger.warn('沒有找到運行中的守護進程');
        return false;
      }

      // 嘗試終止進程
      try {
        process.kill(pid, 'SIGTERM');
        logger.info(`已發送終止信號給進程 ${pid}`);
        
        // 等待進程結束
        await this.waitForProcessEnd(pid, 10000); // 等待 10 秒
        
        // 清理 PID 檔案
        await this.removePidFile();
        
        return true;
      } catch (error) {
        if (error.code === 'ESRCH') {
          // 進程不存在，清理 PID 檔案
          await this.removePidFile();
          logger.info('進程已經結束，清理 PID 檔案');
          return true;
        }
        throw error;
      }
      
    } catch (error) {
      logger.error('停止守護進程失敗:', error);
      throw error;
    }
  }

  /**
   * 重啟守護進程
   */
  async restartDaemon() {
    logger.info('重啟守護進程...');
    await this.stopDaemon();
    
    // 等待一秒確保進程完全結束
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await this.startDaemon();
  }

  /**
   * 檢查守護進程狀態
   */
  async getStatus() {
    try {
      const pid = await this.readPidFile();
      
      if (!pid) {
        return { running: false, pid: null, uptime: null };
      }

      // 檢查進程是否真的在運行
      try {
        process.kill(pid, 0); // 發送信號 0 檢查進程是否存在
        
        // 取得進程資訊
        const stats = await this.getProcessStats(pid);
        
        return {
          running: true,
          pid: pid,
          uptime: stats.uptime,
          memory: stats.memory,
          cpu: stats.cpu
        };
        
      } catch (error) {
        if (error.code === 'ESRCH') {
          // 進程不存在，清理 PID 檔案
          await this.removePidFile();
          return { running: false, pid: null, uptime: null };
        }
        throw error;
      }
      
    } catch (error) {
      logger.error('取得守護進程狀態失敗:', error);
      return { running: false, pid: null, uptime: null, error: error.message };
    }
  }

  /**
   * 檢查守護進程是否正在運行
   */
  async isRunning() {
    const status = await this.getStatus();
    return status.running;
  }

  /**
   * 守護進程化
   */
  daemonize() {
    // 忽略 SIGHUP 信號
    process.on('SIGHUP', () => {
      logger.info('收到 SIGHUP 信號，忽略');
    });

    // 分離控制終端
    if (process.platform !== 'win32') {
      // Unix/Linux 系統才需要分離終端
      try {
        process.chdir('/');
        process.umask(0);
      } catch (error) {
        logger.warn('無法設定守護進程環境:', error);
      }
    }
  }

  /**
   * 寫入 PID 檔案
   */
  async writePidFile() {
    const pidDir = path.dirname(this.pidFile);
    
    // 確保目錄存在
    try {
      await fs.access(pidDir);
    } catch {
      await fs.mkdir(pidDir, { recursive: true });
    }
    
    await fs.writeFile(this.pidFile, process.pid.toString(), 'utf8');
    logger.info(`PID 檔案已寫入: ${this.pidFile}`);
  }

  /**
   * 讀取 PID 檔案
   */
  async readPidFile() {
    try {
      const pidStr = await fs.readFile(this.pidFile, 'utf8');
      const pid = parseInt(pidStr.trim());
      return isNaN(pid) ? null : pid;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null; // 檔案不存在
      }
      throw error;
    }
  }

  /**
   * 移除 PID 檔案
   */
  async removePidFile() {
    try {
      await fs.unlink(this.pidFile);
      logger.info(`PID 檔案已刪除: ${this.pidFile}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.warn(`刪除 PID 檔案失敗: ${error.message}`);
      }
    }
  }

  /**
   * 設定清理處理器
   */
  setupCleanupHandlers() {
    const cleanup = async (signal) => {
      logger.info(`收到 ${signal} 信號，清理守護進程...`);
      try {
        await this.removePidFile();
      } catch (error) {
        logger.error('清理 PID 檔案失敗:', error);
      }
      process.exit(0);
    };

    process.on('SIGTERM', () => cleanup('SIGTERM'));
    process.on('SIGINT', () => cleanup('SIGINT'));
    process.on('exit', () => {
      // 同步清理（不能使用 async）
      try {
        require('fs').unlinkSync(this.pidFile);
      } catch (error) {
        // 忽略清理錯誤
      }
    });
  }

  /**
   * 等待進程結束
   */
  async waitForProcessEnd(pid, timeoutMs = 10000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        process.kill(pid, 0);
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        if (error.code === 'ESRCH') {
          return; // 進程已結束
        }
        throw error;
      }
    }
    
    throw new Error(`進程 ${pid} 未在 ${timeoutMs}ms 內結束`);
  }

  /**
   * 取得進程統計資訊
   */
  async getProcessStats(pid) {
    try {
      // 簡單的進程統計（可根據需要擴展）
      return {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      };
    } catch (error) {
      return { uptime: null, memory: null, cpu: null };
    }
  }
}

module.exports = DaemonManager; 