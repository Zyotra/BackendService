import SSHClient from "../SSHClient/SSHClient";

async function installGoDependencies(ssh: SSHClient): Promise<boolean> {
    try {
        const goInstallCommands: string[] = [
            // Update system
            "sudo apt update && sudo apt upgrade -y",

            // Install prerequisites
            "sudo apt install -y curl wget git build-essential",

            // Install Git
            "sudo apt install git -y",

            // Download and install Go (latest stable - detect architecture)
            "ARCH=$(dpkg --print-architecture) && GO_VERSION=1.22.0 && wget -q https://go.dev/dl/go${GO_VERSION}.linux-${ARCH}.tar.gz -O /tmp/go.tar.gz",
            "sudo rm -rf /usr/local/go",
            "sudo tar -C /usr/local -xzf /tmp/go.tar.gz",
            "rm /tmp/go.tar.gz",

            // Add Go to PATH
            'echo \'export PATH="/usr/local/go/bin:$PATH"\' >> $HOME/.bashrc',
            'echo \'export PATH="/usr/local/go/bin:$PATH"\' >> $HOME/.profile',

            // Create GOPATH directory
            "mkdir -p $HOME/go/{bin,pkg,src}",
            'echo \'export GOPATH="$HOME/go"\' >> $HOME/.bashrc',
            'echo \'export GOPATH="$HOME/go"\' >> $HOME/.profile',
            'echo \'export PATH="$GOPATH/bin:$PATH"\' >> $HOME/.bashrc',
            'echo \'export PATH="$GOPATH/bin:$PATH"\' >> $HOME/.profile',

            // Source .profile in .bashrc for SSH sessions
            'grep -q "source ~/.profile" $HOME/.bashrc || echo "source ~/.profile" >> $HOME/.bashrc',

            // Create symlinks for Go binaries
            "sudo ln -sf /usr/local/go/bin/go /usr/local/bin/go",
            "sudo ln -sf /usr/local/go/bin/gofmt /usr/local/bin/gofmt",

            // Install Go development tools
            "bash -c 'export PATH=\"/usr/local/go/bin:$PATH\" && go install github.com/cosmtrek/air@latest'",        // Live reload
            "bash -c 'export PATH=\"/usr/local/go/bin:$PATH\" && go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest'", // Linter
            "bash -c 'export PATH=\"/usr/local/go/bin:$PATH\" && go install gotest.tools/gotestsum@latest'",        // Test runner

            // Create symlinks for Go tools
            "bash -c 'sudo ln -sf $HOME/go/bin/air /usr/local/bin/air || true'",
            "bash -c 'sudo ln -sf $HOME/go/bin/golangci-lint /usr/local/bin/golangci-lint || true'",
            "bash -c 'sudo ln -sf $HOME/go/bin/gotestsum /usr/local/bin/gotestsum || true'",

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
            'echo "Go Dependencies Install Complete!"',
            'echo "================================"',
            'go version',
            'gofmt -version',
            'bash -c \'export PATH="/usr/local/go/bin:$PATH" && go version\'',
            'nginx -v',
            'git --version',
            'echo "================================"',
        ];

        await ssh.runSequential(goInstallCommands, (logChunk) => {
            console.log("Go Install Log:", logChunk);
        });

        return true;
    } catch (error) {
        console.log("Error in installGoDependencies:", error);
        return false;
    }
}

export default installGoDependencies;
