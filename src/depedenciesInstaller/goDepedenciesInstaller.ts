import SSHClient from "../SSHClient/SSHClient";

async function installGoDependencies(ssh: SSHClient): Promise<boolean> {
    try {
        const goInstallCommands: string[] = [
            // 1. System update and base packages (single batch)
            "sudo apt update && sudo apt install -y curl wget git build-essential nginx --no-install-recommends",

            // 2. Download and install Go + setup environment in one go
            `ARCH=$(dpkg --print-architecture) && \
GO_VERSION=1.22.0 && \
command -v go >/dev/null 2>&1 || (
  wget -q https://go.dev/dl/go\${GO_VERSION}.linux-\${ARCH}.tar.gz -O /tmp/go.tar.gz && \
  sudo rm -rf /usr/local/go && \
  sudo tar -C /usr/local -xzf /tmp/go.tar.gz && \
  rm /tmp/go.tar.gz
) && \
mkdir -p \$HOME/go/{bin,pkg,src}`,

            // 3. Setup environment variables (bashrc and profile) - check first to avoid duplicates
            `if ! grep -q "export PATH=\\/usr/local/go/bin" \$HOME/.bashrc; then
  echo 'export PATH="/usr/local/go/bin:\$PATH"' >> \$HOME/.bashrc
  echo 'export GOPATH="\$HOME/go"' >> \$HOME/.bashrc
  echo 'export PATH="\$GOPATH/bin:\$PATH"' >> \$HOME/.bashrc
  echo 'source ~/.profile' >> \$HOME/.bashrc
fi && \
if ! grep -q "export PATH=\\/usr/local/go/bin" \$HOME/.profile; then
  echo 'export PATH="/usr/local/go/bin:\$PATH"' >> \$HOME/.profile
  echo 'export GOPATH="\$HOME/go"' >> \$HOME/.profile
  echo 'export PATH="\$GOPATH/bin:\$PATH"' >> \$HOME/.profile
fi`,

            // 4. Create symlinks for Go binaries
            "[ -x /usr/local/go/bin/go ] && sudo ln -sf /usr/local/go/bin/go /usr/local/bin/go || true && \
[ -x /usr/local/go/bin/gofmt ] && sudo ln -sf /usr/local/go/bin/gofmt /usr/local/bin/gofmt || true",

            // 5. Install Go development tools (parallel with background, but in pipeline for reliability)
            `export PATH="/usr/local/go/bin:\$PATH" && \
go install github.com/cosmtrek/air@latest 2>/dev/null || true && \
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest 2>/dev/null || true && \
go install gotest.tools/gotestsum@latest 2>/dev/null || true`,

            // 6. Create symlinks for Go tools
            `[ -f \$HOME/go/bin/air ] && sudo ln -sf \$HOME/go/bin/air /usr/local/bin/air || true && \
[ -f \$HOME/go/bin/golangci-lint ] && sudo ln -sf \$HOME/go/bin/golangci-lint /usr/local/bin/golangci-lint || true && \
[ -f \$HOME/go/bin/gotestsum ] && sudo ln -sf \$HOME/go/bin/gotestsum /usr/local/bin/gotestsum || true`,

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
            `echo "=== Go Dependencies Install Complete ===" && \
export PATH="/usr/local/go/bin:\$PATH" && \
go version && \
gofmt -version && \
nginx -v 2>&1 && \
git --version && \
echo "=== Ready to deploy Go applications ==="`,
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
