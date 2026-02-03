import SSHClient from "../SSHClient/SSHClient";

async function installRustDependencies(ssh: SSHClient): Promise<boolean> {
    try {
        const rustInstallCommands: string[] = [
            // Update system
            "sudo apt update && sudo apt upgrade -y",

            // Install prerequisites
            "sudo apt install -y curl wget git build-essential",

            // Install Git
            "sudo apt install git -y",

            // Install Rust using rustup
            "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y",

            // Add Rust to PATH
            'echo \'export PATH="$HOME/.cargo/bin:$PATH"\' >> $HOME/.bashrc',
            'echo \'export PATH="$HOME/.cargo/bin:$PATH"\' >> $HOME/.profile',

            // Source the cargo environment
            'source $HOME/.cargo/env',

            // Source .profile in .bashrc for SSH sessions
            'grep -q "source ~/.profile" $HOME/.bashrc || echo "source ~/.profile" >> $HOME/.bashrc',

            // Update Rust and install components
            "bash -c 'source $HOME/.cargo/env && rustup update'",

            // Install Rust nightly for some projects
            "bash -c 'source $HOME/.cargo/env && rustup install nightly'",

            // Install additional tools (non-blocking - some may fail)
            "bash -c 'source $HOME/.cargo/env && cargo install cargo-watch' || true", // File watcher
            "bash -c 'source $HOME/.cargo/env && cargo install cargo-edit' || true",   // Dependency management
            // Install rustfmt component (cargo fmt)
            "bash -c 'source $HOME/.cargo/env && rustup component add rustfmt' || true",

            // Create symlinks
            "bash -c 'source $HOME/.cargo/env && sudo ln -sf \"$(which cargo)\" /usr/local/bin/cargo'",
            "bash -c 'source $HOME/.cargo/env && sudo ln -sf \"$(which rustc)\" /usr/local/bin/rustc'",
            "bash -c 'source $HOME/.cargo/env && sudo ln -sf \"$(which rustup)\" /usr/local/bin/rustup'",

            // Install Nginx (for reverse proxy)
            "sudo apt install nginx -y",
            "sudo systemctl start nginx",
            "sudo systemctl enable nginx",

            // Install Node.js and PM2 for process management
            "curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt install -y nodejs",
            "sudo npm install -g pm2",
            "pm2 startup systemd -u root --hp /root || true",

            // Verify installations
            'echo "================================"',
            'echo "Rust Dependencies Install Complete!"',
            'echo "================================"',
            'bash -c \'source $HOME/.cargo/env && rustc --version\'',
            'bash -c \'source $HOME/.cargo/env && cargo --version\'',
            'bash -c \'source $HOME/.cargo/env && rustup --version\'',
            'nginx -v',
            'git --version',
            'echo "================================"',
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
