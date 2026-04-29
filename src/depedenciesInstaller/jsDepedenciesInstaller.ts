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
            "bash -lc 'if ! command -v curl >/dev/null 2>&1 || ! command -v git >/dev/null 2>&1 || ! command -v unzip >/dev/null 2>&1; then sudo apt install curl git unzip -y --no-install-recommends --allow-downgrades --allow-remove-essential --allow-change-held-packages; fi' || true",

            // Install nvm
            "bash -lc 'if [ ! -s \"$HOME/.nvm/nvm.sh\" ]; then curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash; fi'",

            // Add nvm to .bashrc (the installer should do this, but let's be explicit)
            'grep -qxF \'export NVM_DIR="$HOME/.nvm"\' $HOME/.bashrc 2>/dev/null || echo \'export NVM_DIR="$HOME/.nvm"\' >> $HOME/.bashrc',
            'grep -qxF \'[ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"\' $HOME/.bashrc 2>/dev/null || echo \'[ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"\' >> $HOME/.bashrc',
            'grep -qxF \'[ -s "$NVM_DIR/bash_completion" ] && \\. "$NVM_DIR/bash_completion"\' $HOME/.bashrc 2>/dev/null || echo \'[ -s "$NVM_DIR/bash_completion" ] && \\. "$NVM_DIR/bash_completion"\' >> $HOME/.bashrc',

            // CRITICAL: Add nvm to .profile for non-interactive shells
            'grep -qxF \'export NVM_DIR="$HOME/.nvm"\' $HOME/.profile 2>/dev/null || echo \'export NVM_DIR="$HOME/.nvm"\' >> $HOME/.profile',
            'grep -qxF \'[ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"\' $HOME/.profile 2>/dev/null || echo \'[ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"\' >> $HOME/.profile',

            // CRITICAL: Source .profile in .bashrc for SSH sessions
            'grep -qxF \'source ~/.profile\' $HOME/.bashrc 2>/dev/null || echo \'source ~/.profile\' >> $HOME/.bashrc',

            // Install Node.js LTS
            "bash -lc 'if ! command -v node >/dev/null 2>&1; then export NVM_DIR=\"$HOME/.nvm\"; if [ -s \"$NVM_DIR/nvm.sh\" ]; then \\. \"$NVM_DIR/nvm.sh\"; nvm install --lts; fi; fi'",

            // Set as default
            "bash -lc 'if [ -s \"$HOME/.nvm/nvm.sh\" ]; then export NVM_DIR=\"$HOME/.nvm\"; \\. \"$NVM_DIR/nvm.sh\"; nvm alias default node; fi'",

            // CRITICAL: Create symlinks so npm/node work everywhere
            "bash -lc 'if command -v node >/dev/null 2>&1; then sudo ln -sf \"$(command -v node)\" /usr/local/bin/node; fi'",
            "bash -lc 'if command -v npm >/dev/null 2>&1; then sudo ln -sf \"$(command -v npm)\" /usr/local/bin/npm; fi'",
            "bash -lc 'if command -v npx >/dev/null 2>&1; then sudo ln -sf \"$(command -v npx)\" /usr/local/bin/npx; fi'",

            // Enable corepack
            "bash -lc 'if command -v corepack >/dev/null 2>&1; then corepack enable; fi'",

            // Install Yarn
            "bash -lc 'if ! command -v yarn >/dev/null 2>&1 && command -v corepack >/dev/null 2>&1; then corepack prepare yarn@stable --activate; fi'",

            // Install pnpm
            "bash -lc 'if ! command -v pnpm >/dev/null 2>&1 && command -v corepack >/dev/null 2>&1; then corepack prepare pnpm@latest --activate; fi'",

            // Create symlinks for yarn and pnpm
            "bash -lc 'if command -v yarn >/dev/null 2>&1; then sudo ln -sf \"$(command -v yarn)\" /usr/local/bin/yarn; fi'",
            "bash -lc 'if command -v pnpm >/dev/null 2>&1; then sudo ln -sf \"$(command -v pnpm)\" /usr/local/bin/pnpm; fi'",

            // Install Bun
            "bash -lc 'if ! command -v bun >/dev/null 2>&1; then curl -fsSL https://bun.sh/install | bash; fi'",
            "bash -lc 'if [ -x \"$HOME/.bun/bin/bun\" ]; then sudo ln -sf \"$HOME/.bun/bin/bun\" /usr/local/bin/bun; fi'",

            // Install global packages
            "bash -lc 'if command -v npm >/dev/null 2>&1; then if [ ! -x \"$(npm root -g)/typescript/bin/tsc\" ] || [ ! -x \"$(npm root -g)/ts-node/dist/bin.js\" ] || [ ! -x \"$(npm root -g)/pm2/bin/pm2\" ]; then npm install -g typescript ts-node pm2; fi; fi'",

            // Create symlinks for global packages
            "bash -lc 'if [ -x \"$(npm root -g)/typescript/bin/tsc\" ]; then sudo ln -sf \"$(npm root -g)/typescript/bin/tsc\" /usr/local/bin/tsc; fi'",
            "bash -lc 'if [ -x \"$(npm root -g)/ts-node/dist/bin.js\" ]; then sudo ln -sf \"$(npm root -g)/ts-node/dist/bin.js\" /usr/local/bin/ts-node; fi'",
            "bash -lc 'if [ -x \"$(npm root -g)/pm2/bin/pm2\" ]; then sudo ln -sf \"$(npm root -g)/pm2/bin/pm2\" /usr/local/bin/pm2; fi'",
            
            // Setup PM2 startup script for auto-restart on server reboot
            "bash -lc 'if command -v pm2 >/dev/null 2>&1; then pm2 startup systemd -u root --hp /root; fi' || true",

            // Install Nginx (non-blocking if fails, since Bun apps don't strictly need it)
            "bash -lc 'if ! command -v nginx >/dev/null 2>&1; then sudo apt install nginx -y --no-install-recommends --allow-downgrades --allow-remove-essential --allow-change-held-packages; fi' || true",

            // Start Nginx
            "bash -lc 'if command -v systemctl >/dev/null 2>&1 && command -v nginx >/dev/null 2>&1; then sudo systemctl start nginx; fi'",

            // Enable Nginx on boot
            "bash -lc 'if command -v systemctl >/dev/null 2>&1 && command -v nginx >/dev/null 2>&1; then sudo systemctl enable nginx; fi'",

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