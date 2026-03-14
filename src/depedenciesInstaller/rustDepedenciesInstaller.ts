import SSHClient from "../SSHClient/SSHClient";

async function installRustDependencies(ssh: SSHClient): Promise<boolean> {
    try {
        const rustInstallCommands: string[] = [
            // 1. System update and base packages
            "sudo apt update && sudo apt install -y curl wget git build-essential nginx --no-install-recommends",

            // 2. Install Rust using rustup (skip if already present)
            `command -v rustc >/dev/null 2>&1 || (
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y && \
  source \$HOME/.cargo/env
)`,

            // 3. Setup environment variables (.profile and .bashrc)
            `if ! grep -q "export PATH=.*cargo" \$HOME/.bashrc; then
  echo 'export PATH="\$HOME/.cargo/bin:\$PATH"' >> \$HOME/.bashrc
  echo 'source ~/.profile' >> \$HOME/.bashrc
fi && \
if ! grep -q "export PATH=.*cargo" \$HOME/.profile; then
  echo 'export PATH="\$HOME/.cargo/bin:\$PATH"' >> \$HOME/.profile
fi`,

            // 4. Update Rust and install components (batched)
            `source \$HOME/.cargo/env && \
rustup update && \
rustup install nightly && \
rustup component add rustfmt 2>/dev/null || true`,

            // 5. Install Rust dev tools (all together, non-blocking)
            `source \$HOME/.cargo/env && \
timeout 60 cargo install cargo-watch 2>/dev/null || true && \
timeout 60 cargo install cargo-edit 2>/dev/null || true`,

            // 6. Create symlinks for Rust binaries
            `[ -x \$HOME/.cargo/bin/cargo ] && sudo ln -sf \$HOME/.cargo/bin/cargo /usr/local/bin/cargo || true && \
[ -x \$HOME/.cargo/bin/rustc ] && sudo ln -sf \$HOME/.cargo/bin/rustc /usr/local/bin/rustc || true && \
[ -x \$HOME/.cargo/bin/rustup ] && sudo ln -sf \$HOME/.cargo/bin/rustup /usr/local/bin/rustup || true`,

            // 7. Install Node.js and PM2 if not present
            `command -v pm2 >/dev/null 2>&1 || (
  curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && \
  sudo apt install -y nodejs --no-install-recommends && \
  sudo npm install -g pm2 && \
  pm2 startup systemd -u root --hp /root 2>/dev/null || true
)`,

            // 8. Start Nginx and enable services
            "sudo systemctl start nginx && sudo systemctl enable nginx",

            // 9. Final verification
            `echo "=== Rust Dependencies Install Complete ===" && \
source \$HOME/.cargo/env && \
rustc --version && \
cargo --version && \
rustup --version && \
nginx -v 2>&1 && \
git --version && \
echo "=== Ready to deploy Rust applications ==="`,,
        ];

        await ssh.runSequential(rustInstallCommands, (logChunk) => {
            console.log("Rust Install Log:", logChunk);
        });

        return true;
    } catch (error) {
        console.log("Error in installRustDependencies:", error);
        return false;
    }
}

export default installRustDependencies;
