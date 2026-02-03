import SSHClient from "../SSHClient/SSHClient";
import fs from "fs";
import getRedisConfig from "../utils/getRedisConfig";
interface CommandResult {
  command: string;
  output: string;
  exitCode: number;
}

interface RedisInfo {
  version: string;
  uptime: string;
  connectedClients: number;
  usedMemory: string;
  totalKeys: number;
}

interface RedisKeyInfo {
  key: string;
  type: string;
  ttl: number; // -1 = no expiry, -2 = key doesn't exist
  size?: number;
}

class RedisHelper {
  private ssh: SSHClient;
  private redisServerPath: string = "redis-server";
  private redisCliPath: string = "redis-cli";

  constructor(ssh: SSHClient) {
    this.ssh = ssh;
  }

  /**
   * Detect where redis-server is installed and set the correct paths
   */
  private async detectRedisPaths(): Promise<void> {
    // Check standard path first
    const stdCheck = await this.ssh.exec(`which redis-server 2>/dev/null`);
    if (stdCheck.exitCode === 0 && stdCheck.output?.trim()) {
      this.redisServerPath = stdCheck.output.trim();
      const cliCheck = await this.ssh.exec(`which redis-cli 2>/dev/null`);
      this.redisCliPath = cliCheck.output?.trim() || "redis-cli";
      return;
    }

    // Check snap paths
    const snapServerCheck = await this.ssh.exec(`test -x /snap/bin/redis.server && echo "/snap/bin/redis.server"`);
    if (snapServerCheck.exitCode === 0 && snapServerCheck.output?.includes("/snap/bin")) {
      this.redisServerPath = "/snap/bin/redis.server";
      this.redisCliPath = "/snap/bin/redis.cli";
      return;
    }

    // Check alternative snap path
    const snapCheck2 = await this.ssh.exec(`test -x /snap/redis/current/usr/bin/redis-server && echo "found"`);
    if (snapCheck2.exitCode === 0 && snapCheck2.output?.includes("found")) {
      this.redisServerPath = "/snap/redis/current/usr/bin/redis-server";
      this.redisCliPath = "/snap/redis/current/usr/bin/redis-cli";
      return;
    }

    // Default fallback
    this.redisServerPath = "redis-server";
    this.redisCliPath = "redis-cli";
  }

  async installRedisCLI(onLog?: (chunk: string) => {}) {
    console.log("Installing redis cli");
    
    // First, try to fix system packages (ignore errors - system may be in bad state)
    const fixCommands = [
      `sudo dpkg --configure -a || true`,
      `sudo apt --fix-broken install -y || true`,
      `sudo apt-get clean || true`,
      `sudo apt-get update || true`,
    ];
    
    for (const cmd of fixCommands) {
      try {
        await this.ssh.exec(cmd, onLog);
      } catch (e) {
        console.log(`Fix command failed (continuing): ${cmd}`);
      }
    }

    // Detect if redis is already installed (apt or snap)
    await this.detectRedisPaths();
    const checkRedis = await this.ssh.exec(`${this.redisServerPath} --version 2>/dev/null`);
    
    if (checkRedis.exitCode !== 0) {
      // Try to install redis via apt
      const installResult = await this.ssh.exec(`sudo apt install redis-server -y`, onLog);
      if (installResult.exitCode !== 0) {
        // If apt fails, try installing via snap as fallback
        console.log("apt install failed, trying snap...");
        await this.ssh.exec(`sudo snap install redis`, onLog);
      }
      // Re-detect paths after installation
      await this.detectRedisPaths();
    }

    // Verify redis-server is now available
    const verifyRedis = await this.ssh.exec(`${this.redisServerPath} --version`);
    if (verifyRedis.exitCode !== 0) {
      throw new Error(`Redis installation failed. redis-server not found at ${this.redisServerPath}`);
    }
    console.log(`Redis found at: ${this.redisServerPath}`);
    
    // Create redis user if it doesn't exist (ignore errors)
    await this.ssh.exec(`id -u redis > /dev/null 2>&1 || sudo useradd -r -s /bin/false redis || true`, onLog);
    
    // Create required directories (ignore errors)
    await this.ssh.exec(`sudo mkdir -p /etc/redis /var/lib/redis /var/log/redis /var/run/redis`, onLog);
    await this.ssh.exec(`sudo chown -R redis:redis /var/lib/redis /var/log/redis /var/run/redis 2>/dev/null || true`, onLog);
  }
  async deleteRedisServer(redisName: string, password: string, port: string, onLog?: (chunk: string) => {}) {
    await this.detectRedisPaths();
    const commands = [
      // Shutdown redis (ignore errors if not running)
      `${this.redisCliPath} -p ${port} -a ${password} shutdown || true`,
      // Kill any remaining redis process on this port
      `sudo kill $(sudo lsof -t -i:${port}) 2>/dev/null || true`,
      // Disable systemd service if it exists (ignore errors)
      `sudo systemctl disable ${redisName} 2>/dev/null || true`,
      `sudo systemctl stop ${redisName} 2>/dev/null || true`,
      // Remove service file if it exists
      `sudo rm -f /etc/systemd/system/${redisName}.service`,
      // Reload systemd
      `sudo systemctl daemon-reexec`,
      `sudo systemctl daemon-reload`,
      // Remove config and data files
      `sudo rm -f /etc/redis/${redisName}.conf`,
      `sudo rm -f /var/log/redis/${redisName}.log`,
      `sudo rm -rf /var/lib/${redisName}`
    ];
    await this.ssh.runSequential(commands, onLog);
  }
  async startNewRedisServer(
    name: string,
    password: string,
    port: string,
    onLog?: (chunk: string) => void
  ) {
    // Make sure we have the correct redis paths
    await this.detectRedisPaths();
    
    const configPath = `/etc/redis/${name}.conf`;
    const dataDir = `/var/lib/${name}`;
    const pidDir = `/var/run/redis`;

    const config = getRedisConfig(port, name, password);
    const configB64 = Buffer.from(config).toString("base64");

    const tmpPath = `/tmp/${name}.conf`;

    const commands = [
      // create redis config dir if it doesn't exist
      `sudo mkdir -p /etc/redis`,
      // create dirs (try without sudo, fallback to sudo)
      `sudo mkdir -p ${dataDir}`,
      `sudo mkdir -p ${pidDir}`,
      // write decoded config to /tmp (avoid sudo/tee interactive problems)
      `echo '${configB64}' | base64 -d > ${tmpPath}`,
      // move into place with sudo
      `sudo mv ${tmpPath} ${configPath}`,
      // set ownership/permissions (ignore if redis user doesn't exist)
      `sudo chown redis:redis ${dataDir} 2>/dev/null || sudo chown root:root ${dataDir} || true`,
      `sudo chmod 750 ${dataDir} || true`,
      `sudo chown redis:redis ${configPath} 2>/dev/null || sudo chown root:root ${configPath} || true`,
      `sudo chmod 640 ${configPath} || true`,
      // start redis using detected path
      `sudo ${this.redisServerPath} ${configPath} --daemonize yes`
    ];
    await this.ssh.runSequential(commands, onLog);

    // verify start using detected cli path
    const check = await this.ssh.exec(`${this.redisCliPath} -p ${port} -a ${password} ping`);
    if (check.exitCode !== 0 || !/PONG/.test(check.output || "")) {
      throw new Error(`Failed to start redis: ${check.output}`);
    }
  }
  async stopRedisSever(password: string, port: string) {
    await this.detectRedisPaths();
    await this.ssh.exec(`${this.redisCliPath} -p ${port} -a ${password} shutdown`)
  }

  async startExistingRedisServer(name: string, password: string, port: string) {
    await this.detectRedisPaths();
    const configPath = `/etc/redis/${name}.conf`;
    
    // Start redis server using existing config
    const result = await this.ssh.exec(
      `sudo ${this.redisServerPath} ${configPath} --daemonize yes`
    );
    
    if (result.exitCode !== 0) {
      throw new Error(`Failed to start redis server: ${result.output}`);
    }

    // Verify start
    const check = await this.ssh.exec(`${this.redisCliPath} -p ${port} -a ${password} ping`);
    if (check.exitCode !== 0 || !/PONG/.test(check.output || "")) {
      throw new Error(`Failed to verify redis start: ${check.output}`);
    }
  }
}
export default RedisHelper;
