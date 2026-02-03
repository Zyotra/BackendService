import SSHClient from "../SSHClient/SSHClient";

async function installPythonDependencies(ssh: SSHClient): Promise<boolean> {
    try {
        const pythonInstallCommands: string[] = [
            // Check if Python3 is already installed - if yes, skip apt install
            // This handles VPS with broken apt but working Python
            `python3 --version && echo "Python already installed, skipping apt" || (
                sudo DEBIAN_FRONTEND=noninteractive dpkg --configure -a 2>/dev/null;
                sudo rm -rf /var/lib/apt/lists/* 2>/dev/null;
                sudo apt-get clean 2>/dev/null;
                sudo DEBIAN_FRONTEND=noninteractive apt-get update -y;
                sudo DEBIAN_FRONTEND=noninteractive apt-get install -y python3 python3-pip python3-venv
            )`,
            
            // Check if nginx is already installed - if yes, skip
            `nginx -v 2>&1 && echo "Nginx already installed" || (
                sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nginx
            )`,
            
            // Enable and start nginx
            "sudo systemctl enable nginx 2>/dev/null || true",
            "sudo systemctl start nginx 2>/dev/null || true",
            
            // Install Node.js and PM2 for process management
            `(command -v pm2 && echo "PM2 already installed") || (
                curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - &&
                sudo apt install -y nodejs &&
                sudo npm install -g pm2 &&
                pm2 startup systemd -u root --hp /root || true
            )`,
            
            // Check if certbot is already installed - if yes, skip (optional)
            `certbot --version 2>&1 && echo "Certbot already installed" || (
                sudo DEBIAN_FRONTEND=noninteractive apt-get install -y certbot python3-certbot-nginx 2>/dev/null || true
            )`,
            
            // Final verification - Python MUST work
            'python3 --version && echo "✓ Python ready"',
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