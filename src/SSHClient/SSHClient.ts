import { Client, ConnectConfig } from "ssh2";
interface CommandResult {
    command: string;
    output: string;
    exitCode: number;
}
const updateNodeCommands: string[] = [
    // Install/Update NVM (Version 0.40.1 is current for late 2024/2025)
    "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash",
    // Load NVM into the current session
    "export NVM_DIR=\"$HOME/.nvm\" && [ -s \"$NVM_DIR/nvm.sh\" ] && \\. \"$NVM_DIR/nvm.sh\"",
    // Install latest Long Term Support (LTS) version
    "nvm install --lts",
    // Set it as default
    "nvm alias default 'lts/*'",
    // Update NPM to the absolute latest version
    "npm install -g npm@latest"
];

const installGlobalTools: string[] = [
    "npm install -g pm2",                // For keeping your app alive
    "npm install -g npm-check-updates",  // For checking package updates
    "npm install -g typescript"          // Global compiler access
];
class SSHClient {
    private conn: Client;
    private config: ConnectConfig;
    private isConnected: boolean = false;
    private onError?: (error: Error) => void;
    
    constructor(config: ConnectConfig) {
        this.conn = new Client();
        this.config = config;
        
        // Prevent unhandled error crashes
        this.conn.on('error', (err) => {
            console.error('[SSHClient] Connection error:', err.message);
            this.isConnected = false;
            if (this.onError) this.onError(err);
        });
        
        this.conn.on('close', () => {
            console.log('[SSHClient] Connection closed');
            this.isConnected = false;
        });
        
        this.conn.on('end', () => {
            console.log('[SSHClient] Connection ended');
            this.isConnected = false;
        });
    }
    
    setErrorHandler(handler: (error: Error) => void): void {
        this.onError = handler;
    }
    
    isAlive(): boolean {
        return this.isConnected;
    }
    
    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.conn.once('ready', () => {
                this.isConnected = true;
                resolve();
            });
            this.conn.once('error', reject);
            this.conn.connect(this.config);
        });
    }

    exec(command: string, onLog?: (chunk: string) => void): Promise<CommandResult> {
        return new Promise((resolve, reject) => {
            if (!this.isConnected) {
                return reject(new Error('SSH connection is not active'));
            }
            
            this.conn.exec(command, (err, stream) => {
                if (err) return reject(err);

                let output = '';
                let stderr = '';

                stream.on('error', (err: Error) => {
                    console.error('[SSHClient] Stream error:', err.message);
                    reject(err);
                });

                // 2. Listen to the stream events
                stream.on('data', async (data: Buffer) => {
                    await new Promise(res => process.nextTick(res));
                    await Bun.sleep(1)
                    const chunk = data.toString();
                    console.log(chunk)
                    output += chunk;
                    // 3. If a callback exists, send data immediately
                    if (onLog) onLog(chunk);
                });

                stream.stderr.on('data', async (data: Buffer) => {
                    await new Promise(res => process.nextTick(res));
                    await Bun.sleep(1)
                    const chunk = data.toString();
                    console.log(chunk)
                    stderr += chunk;
                    // Stream errors too (maybe prefix with [ERR])
                    if (onLog) onLog(chunk);
                });

                stream.on('close', async (exitCode: number) => {
                    await new Promise(res => process.nextTick(res));
                    await Bun.sleep(1)
                    resolve({ command, output, exitCode });
                });
            });
        });
    }
    // New method for streaming execution
    async execStream(
        command: string,
        callbacks: {
            onStdout?: (data: string) => void;
            onStderr?: (data: string) => void;
            onClose?: () => void;
        }
    ) {
        return new Promise((resolve, reject) => {
            if (!this.isConnected) {
                callbacks.onClose?.();
                return reject(new Error('SSH connection is not active'));
            }
            
            this.conn.exec(command, (err: any, stream: any) => {
                if (err) {
                    callbacks.onClose?.();
                    reject(err);
                    return;
                }

                stream.on('error', (err: Error) => {
                    console.error('[SSHClient] Stream error:', err.message);
                    callbacks.onClose?.();
                    reject(err);
                });

                stream.on('data', (data: Buffer) => {
                    callbacks.onStdout?.(data.toString());
                });

                stream.stderr.on('data', (data: Buffer) => {
                    callbacks.onStderr?.(data.toString());
                });

                stream.on('close', () => {
                    callbacks.onClose?.();
                    resolve(null);
                });
            });
        });
    }
    // 4. Update sequential runner to pass the callback down
    async runSequential(commands: string[], onLog?: (chunk: string) => void): Promise<CommandResult[]> {
        const results: CommandResult[] = [];
        for (const cmd of commands) {
            const result = await this.exec(cmd, onLog);
            results.push(result);
            if (result.exitCode !== 0) {
                if (onLog) onLog(`Command "${cmd}" failed with exit code ${result.exitCode}. Stopping execution.\n`);
                throw new Error(`Command "${cmd}" failed with exit code ${result.exitCode}`);
            }
        }
        return results;
    }

    close(): void {
        try {
            if (this.isConnected) {
                this.conn.end();
            }
            this.isConnected = false;
        } catch (error) {
            console.error('[SSHClient] Error closing connection:', error);
            this.isConnected = false;
        }
    }
}

export default SSHClient;