import SSHClient from "../SSHClient/SSHClient";
import socketManager from "../ws/socketManager";

const installDotnetDependencies = async (ssh: SSHClient, deploymentId?: string): Promise<boolean> => {
    try {
        const dotnetInstallCommands = [
            // 1. System update and base packages (single batch)
            "sudo apt update && sudo apt install -y curl wget gpg lsb-release ca-certificates build-essential git nginx --no-install-recommends",

            // 2. Add Microsoft repository and install .NET SDK (batched)
            `command -v dotnet >/dev/null 2>&1 || (
  wget -q https://packages.microsoft.com/config/ubuntu/\$(lsb_release -rs)/packages-microsoft-prod.deb -O /tmp/packages-microsoft-prod.deb && \
  sudo dpkg -i /tmp/packages-microsoft-prod.deb && \
  rm /tmp/packages-microsoft-prod.deb && \
  sudo apt update && \
  sudo apt install -y dotnet-sdk-8.0 dotnet-runtime-8.0 aspnetcore-runtime-8.0 --no-install-recommends
)`,

            // 3. Create symlinks for dotnet
            "[ -x \$(which dotnet) ] && sudo ln -sf \$(which dotnet) /usr/local/bin/dotnet || true",

            // 4. Install Entity Framework and formatting tools
            `command -v dotnet-ef >/dev/null 2>&1 || (
  dotnet tool install --global dotnet-ef 2>/dev/null && \
  sudo ln -sf \\$HOME/.dotnet/tools/dotnet-ef /usr/local/bin/dotnet-ef || true
) && \
dotnet tool install --global dotnet-format 2>/dev/null || true && \
[ -f \\$HOME/.dotnet/tools/dotnet-format ] && sudo ln -sf \\$HOME/.dotnet/tools/dotnet-format /usr/local/bin/dotnet-format || true`,

            // 5. Install Node.js and PM2 if not present
            `command -v pm2 >/dev/null 2>&1 || (
  curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && \
  sudo apt install -y nodejs --no-install-recommends && \
  sudo npm install -g pm2 && \
  pm2 startup systemd -u root --hp /root 2>/dev/null || true
)`,

            // 6. Start Nginx and enable services
            "sudo systemctl start nginx && sudo systemctl enable nginx",

            // 7. Final verification
            `echo "=== .NET Dependencies Install Complete ===" && \
dotnet --version && \
nginx -v 2>&1 && \
git --version && \
echo "=== Ready to deploy .NET applications ==="`,
        ];

        await ssh.runSequential(dotnetInstallCommands, (logChunk) => {
            if (deploymentId) {
                socketManager.emitLog(deploymentId, logChunk);
            } else {
                console.log("Dotnet Install Log:", logChunk);
            }
        });
        return true;
    } catch (error) {
        console.log("Error in installDotnetDependencies:", error);
        return false;
    }
}

export default installDotnetDependencies;
