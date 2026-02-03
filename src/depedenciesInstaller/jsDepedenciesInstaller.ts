import SSHClient from "../SSHClient/SSHClient";

async function jsDepedenciesInstaller(ssh: SSHClient): Promise<boolean> {
    try {
        const javascriptInstallCommands: string[] = [
            // CRITICAL: Aggressive cleanup of broken apt state from previous failed installations
            "sudo dpkg --configure -a || true",
            "sudo apt clean || true",
            "sudo apt autoclean || true",
            
            // Update package lists with fix-missing option for corrupted systems
            "sudo apt update --fix-missing || true",

            // Try to install curl and git with maximum compatibility flags
            // --allow-downgrades --allow-remove-essential --allow-change-held-packages for broken systems
            "sudo apt install curl git -y --no-install-recommends --allow-downgrades --allow-remove-essential --allow-change-held-packages || true",

            // Install nvm
            "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash",

            // Add nvm to .bashrc (the installer should do this, but let's be explicit)
            'echo \'export NVM_DIR="$HOME/.nvm"\' >> $HOME/.bashrc',
            'echo \'[ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"\' >> $HOME/.bashrc',
            'echo \'[ -s "$NVM_DIR/bash_completion" ] && \\. "$NVM_DIR/bash_completion"\' >> $HOME/.bashrc',

            // CRITICAL: Add nvm to .profile for non-interactive shells
            'echo \'export NVM_DIR="$HOME/.nvm"\' >> $HOME/.profile',
            'echo \'[ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"\' >> $HOME/.profile',

            // CRITICAL: Source .profile in .bashrc for SSH sessions
            'grep -q "source ~/.profile" $HOME/.bashrc || echo "source ~/.profile" >> $HOME/.bashrc',

            // Install Node.js LTS
            "bash -c 'export NVM_DIR=\"$HOME/.nvm\" && [ -s \"$NVM_DIR/nvm.sh\" ] && \\. \"$NVM_DIR/nvm.sh\" && nvm install --lts'",

            // Set as default
            "bash -c 'export NVM_DIR=\"$HOME/.nvm\" && [ -s \"$NVM_DIR/nvm.sh\" ] && \\. \"$NVM_DIR/nvm.sh\" && nvm alias default node'",

            // CRITICAL: Create symlinks so npm/node work everywhere
            "bash -c 'export NVM_DIR=\"$HOME/.nvm\" && [ -s \"$NVM_DIR/nvm.sh\" ] && \\. \"$NVM_DIR/nvm.sh\" && sudo ln -sf \"$(which node)\" /usr/local/bin/node'",
            "bash -c 'export NVM_DIR=\"$HOME/.nvm\" && [ -s \"$NVM_DIR/nvm.sh\" ] && \\. \"$NVM_DIR/nvm.sh\" && sudo ln -sf \"$(which npm)\" /usr/local/bin/npm'",
            "bash -c 'export NVM_DIR=\"$HOME/.nvm\" && [ -s \"$NVM_DIR/nvm.sh\" ] && \\. \"$NVM_DIR/nvm.sh\" && sudo ln -sf \"$(which npx)\" /usr/local/bin/npx'",

            // Enable corepack
            "bash -c 'export NVM_DIR=\"$HOME/.nvm\" && [ -s \"$NVM_DIR/nvm.sh\" ] && \\. \"$NVM_DIR/nvm.sh\" && corepack enable'",

            // Install Yarn
            "bash -c 'export NVM_DIR=\"$HOME/.nvm\" && [ -s \"$NVM_DIR/nvm.sh\" ] && \\. \"$NVM_DIR/nvm.sh\" && corepack prepare yarn@stable --activate'",

            // Install pnpm
            "bash -c 'export NVM_DIR=\"$HOME/.nvm\" && [ -s \"$NVM_DIR/nvm.sh\" ] && \\. \"$NVM_DIR/nvm.sh\" && corepack prepare pnpm@latest --activate'",

            // Create symlinks for yarn and pnpm
            "bash -c 'export NVM_DIR=\"$HOME/.nvm\" && [ -s \"$NVM_DIR/nvm.sh\" ] && \\. \"$NVM_DIR/nvm.sh\" && sudo ln -sf \"$(which yarn)\" /usr/local/bin/yarn'",
            "bash -c 'export NVM_DIR=\"$HOME/.nvm\" && [ -s \"$NVM_DIR/nvm.sh\" ] && \\. \"$NVM_DIR/nvm.sh\" && sudo ln -sf \"$(which pnpm)\" /usr/local/bin/pnpm'",

            // Install Bun
            "curl -fsSL https://bun.sh/install | bash",
            "sudo ln -sf $HOME/.bun/bin/bun /usr/local/bin/bun",

            // Install global packages
            "npm install -g typescript ts-node pm2",

            // Create symlinks for global packages
            "sudo ln -sf $(npm root -g)/typescript/bin/tsc /usr/local/bin/tsc",
            "sudo ln -sf $(npm root -g)/ts-node/dist/bin.js /usr/local/bin/ts-node",
            "sudo ln -sf $(npm root -g)/pm2/bin/pm2 /usr/local/bin/pm2",
            
            // Setup PM2 startup script for auto-restart on server reboot
            "pm2 startup systemd -u root --hp /root || true",

            // Install Nginx (non-blocking if fails, since Bun apps don't strictly need it)
            "sudo apt install nginx -y --no-install-recommends --allow-downgrades --allow-remove-essential --allow-change-held-packages || true",

            // Start Nginx
            "sudo systemctl start nginx",

            // Enable Nginx on boot
            "sudo systemctl enable nginx",

            // Verify installations
            'echo "Node: $(node -v)"',
            'echo "npm: $(npm -v)"',
            'echo "Yarn: $(yarn -v)"',
            'echo "pnpm: $(pnpm -v)"',
            'echo "Bun: $(bun -v)"',
            'echo "TypeScript: $(tsc -v)"',
            'echo "ts-node: $(ts-node -v)"',
            'echo "PM2: $(pm2 -v)"',
            'echo "Nginx: $(nginx -v 2>&1)"',
            'echo "Git: $(git --version)"',
        ];

        await ssh.runSequential(javascriptInstallCommands, (logChunk) => {
            console.log("Install Log:", logChunk);
        });
        return true;
    } catch (error) {
        console.log("Error in jsDepedenciesInstaller:", error);
        return false;
    }
}
export default jsDepedenciesInstaller;