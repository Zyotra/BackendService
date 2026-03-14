import SSHClient from "../SSHClient/SSHClient";

async function installPythonDependencies(ssh: SSHClient): Promise<boolean> {
    try {
        const pythonInstallCommands: string[] = [
            // Setup Python and system tools (batched)
            `python3 --version >/dev/null 2>&1 || (
                sudo DEBIAN_FRONTEND=noninteractive apt update --fix-missing && \
                sudo DEBIAN_FRONTEND=noninteractive apt install -y python3 python3-pip python3-venv curl git build-essential --no-install-recommends
            ) && \
            echo "✓ Python ready"`,

            // Install Nginx if not already present
            `nginx -v 2>&1 | grep -q 'nginx' && echo "✓ Nginx already installed" || (
                sudo DEBIAN_FRONTEND=noninteractive apt install -y nginx --no-install-recommends && \
                sudo systemctl enable nginx && \
                sudo systemctl start nginx && \
                echo "✓ Nginx installed"
            )`,

            // Install Node.js and PM2 if not present
            `command -v pm2 >/dev/null 2>&1 && echo "✓ PM2 already installed" || (
                curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && \
                sudo apt install -y nodejs --no-install-recommends && \
                sudo npm install -g pm2 && \
                pm2 startup systemd -u root --hp /root 2>/dev/null || true && \
                echo "✓ PM2 installed"
            )`,

            // Install certbot if not present (optional, non-blocking)
            `certbot --version >/dev/null 2>&1 2>/dev/null || (
                sudo DEBIAN_FRONTEND=noninteractive apt install -y certbot python3-certbot-nginx --no-install-recommends 2>/dev/null || true
            ) && echo "✓ Setup complete"`,

            // Final verification
            'echo "=== Python Dependencies Ready ===" && python3 --version && pip3 --version',
        ];
        
        await ssh.runSequential(pythonInstallCommands, (logChunk) => {
            console.log("Install Log:", logChunk);
        });
        
        return true;
    } catch (error) {
        console.log("Error in installPythonDependencies:", error);
        return false;
    }
}

export default installPythonDependencies;