import SSHClient from "../SSHClient/SSHClient";

async function jsDepedenciesInstaller(ssh: SSHClient): Promise<boolean> {
    try {
        const javascriptInstallCommands: string[] = [
            // 1. System update and base packages (single batch for speed)
            "sudo apt update && sudo apt install -y curl git build-essential nginx --no-install-recommends",
            
            // 2. Install NVM and configure environment in one go  
            `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash && \
export NVM_DIR="\$HOME/.nvm" && \
[ -s "\$NVM_DIR/nvm.sh" ] && \\. "\$NVM_DIR/nvm.sh" && \
nvm install --lts && \
nvm alias default node`,

            // 3. Install and configure Bun
            "curl -fsSL https://bun.sh/install | bash",

            // 4. Setup environment variables (.profile and .bashrc) in one operation
            `if ! grep -q "export NVM_DIR" \$HOME/.bashrc; then
  echo 'export NVM_DIR="\$HOME/.nvm"' >> \$HOME/.bashrc
  echo '[ -s "\$NVM_DIR/nvm.sh" ] && \\. "\$NVM_DIR/nvm.sh"' >> \$HOME/.bashrc
  echo 'grep -q "source ~/.profile" \$HOME/.bashrc || echo "source ~/.profile" >> \$HOME/.bashrc' >> \$HOME/.bashrc
fi && \
if ! grep -q "export NVM_DIR" \$HOME/.profile; then
  echo 'export NVM_DIR="\$HOME/.nvm"' >> \$HOME/.profile
  echo '[ -s "\$NVM_DIR/nvm.sh" ] && \\. "\$NVM_DIR/nvm.sh"' >> \$HOME/.profile
fi`,

            // 5. Install npm global packages (must source NVM first)
            `export NVM_DIR="\$HOME/.nvm" && [ -s "\$NVM_DIR/nvm.sh" ] && \\. "\$NVM_DIR/nvm.sh" && \
npm install -g pm2 typescript ts-node && \
corepack enable && \
corepack prepare yarn@stable --activate && \
corepack prepare pnpm@latest --activate`,

            // 6. Create all symlinks in one batch operation
            `export NVM_DIR="\$HOME/.nvm" && [ -s "\$NVM_DIR/nvm.sh" ] && \\. "\$NVM_DIR/nvm.sh" && \
NODE=$(which node) && NPM=$(which npm) && NPX=$(which npx) && \
YARN=$(which yarn) && PNPM=$(which pnpm) && \
BUN="\$HOME/.bun/bin/bun" && \
TSC=$(npm root -g)/typescript/bin/tsc && \
TS_NODE=$(npm root -g)/ts-node/dist/bin.js && \
PM2=$(npm root -g)/pm2/bin/pm2 && \
[ -n "\$NODE" ] && sudo ln -sf "\$NODE" /usr/local/bin/node || true && \
[ -n "\$NPM" ] && sudo ln -sf "\$NPM" /usr/local/bin/npm || true && \
[ -n "\$NPX" ] && sudo ln -sf "\$NPX" /usr/local/bin/npx || true && \
[ -n "\$YARN" ] && sudo ln -sf "\$YARN" /usr/local/bin/yarn || true && \
[ -n "\$PNPM" ] && sudo ln -sf "\$PNPM" /usr/local/bin/pnpm || true && \
[ -f "\$BUN" ] && sudo ln -sf "\$BUN" /usr/local/bin/bun || true && \
[ -f "\$TSC" ] && sudo ln -sf "\$TSC" /usr/local/bin/tsc || true && \
[ -f "\$TS_NODE" ] && sudo ln -sf "\$TS_NODE" /usr/local/bin/ts-node || true && \
[ -f "\$PM2" ] && sudo ln -sf "\$PM2" /usr/local/bin/pm2 || true`,

            // 7. Setup PM2 and Nginx services 
            "pm2 startup systemd -u root --hp /root || true && sudo systemctl start nginx && sudo systemctl enable nginx",

            // 8. Final verification
            `echo "=== JavaScript Dependencies Installed ===" && \
node -v && npm -v && bun -v && pm2 -v && \
echo "Yarn: \$(yarn -v || echo 'pending')" && \
echo "pnpm: \$(pnpm -v || echo 'pending')" && \
echo "TypeScript: \$(tsc -v 2>&1 || echo 'pending')" && \
echo "Nginx status: \$(nginx -v 2>&1 || echo 'not running')"`,
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