import SSHClient from "../SSHClient/SSHClient";

// Log buffer to batch logs and prevent SSH channel exhaustion
const logBuffer: Map<string, string[]> = new Map();
const flushTimers: Map<string, NodeJS.Timeout> = new Map();
const FLUSH_DELAY = 2000; // 2 seconds

/**
 * Flushes buffered logs to the remote machine
 */
async function flushLogs(deploymentId: string, ssh: SSHClient) {
  const buffer = logBuffer.get(deploymentId);
  if (!buffer || buffer.length === 0) return;

  const logs = buffer.splice(0, buffer.length);
  const logSubDir = "webservice-logs";
  const baseDir = `$HOME/logs/${logSubDir}`;
  const filePath = `${baseDir}/${deploymentId}.log`;

  // Combine all logs into one command
  const escapedLogs = logs.map(log => {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] ${log.replace(/'/g, "'\"'\"'")}`;
  }).join('\n');

  const command = `mkdir -p "${baseDir}" && echo '${escapedLogs}' >> "${filePath}"`;

  try {
    await ssh.exec(command);
  } catch (error) {
    console.error(`Failed to save log to remote: ${error}`);
  }
}

/**
 * Appends a single log line to a deployment log file on the remote machine.
 * Uses buffering to prevent SSH channel exhaustion.
 * Saves to $HOME/deployment-logs which works for any user.
 */
export async function saveLog(
  deploymentId: string,
  log: string,
  ssh: SSHClient
) {
  // Add to buffer
  if (!logBuffer.has(deploymentId)) {
    logBuffer.set(deploymentId, []);
  }
  logBuffer.get(deploymentId)!.push(log);

  // Clear existing timer and set new one
  const existingTimer = flushTimers.get(deploymentId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  // Flush after delay or when buffer is large
  const buffer = logBuffer.get(deploymentId)!;
  if (buffer.length >= 10) {
    // Immediate flush for large buffers
    await flushLogs(deploymentId, ssh);
  } else {
    // Delayed flush for small buffers
    const timer = setTimeout(() => {
      flushLogs(deploymentId, ssh).catch(console.error);
      flushTimers.delete(deploymentId);
    }, FLUSH_DELAY);
    flushTimers.set(deploymentId, timer);
  }
}

/**
 * Force flush all pending logs for a deployment
 */
export async function flushDeploymentLogs(deploymentId: string, ssh: SSHClient) {
  const timer = flushTimers.get(deploymentId);
  if (timer) {
    clearTimeout(timer);
    flushTimers.delete(deploymentId);
  }
  await flushLogs(deploymentId, ssh);
}
