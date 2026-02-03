import SSHClient from "../SSHClient/SSHClient";
import socketManager from "../ws/socketManager";

const installDotnetDependencies = async (ssh: SSHClient, deploymentId?: string): Promise<boolean> => {
    try {
        const dotnetInstallCommands = [
            "sudo apt update",
            "sudo apt upgrade -y",
            
            // Install prerequisites
            "sudo apt install -y curl wget gpg lsb-release ca-certificates build-essential",
            
            // Install Git
            "sudo apt install git -y",
            
            // Add Microsoft package repository
            "wget https://packages.microsoft.com/config/ubuntu/$(lsb_release -rs)/packages-microsoft-prod.deb -O packages-microsoft-prod.deb",
            "sudo dpkg -i packages-microsoft-prod.deb",
            "rm packages-microsoft-prod.deb",
            
            // Install .NET SDK
            "sudo apt update",
            "sudo apt install -y dotnet-sdk-8.0",
            
            // Install .NET Runtime
            "sudo apt install -y dotnet-runtime-8.0",
            
            // Install ASP.NET Core Runtime
            "sudo apt install -y aspnetcore-runtime-8.0",
            
            // Create symlinks for global access
            "sudo ln -sf $(which dotnet) /usr/local/bin/dotnet || true",
            
            // Install Entity Framework Core tools
            "dotnet tool install --global dotnet-ef",
            "sudo ln -sf $HOME/.dotnet/tools/dotnet-ef /usr/local/bin/dotnet-ef || true",
            
            // Install additional tools
            "dotnet tool install --global dotnet-format",
            "sudo ln -sf $HOME/.dotnet/tools/dotnet-format /usr/local/bin/dotnet-format || true",
            
            // Install Nginx for reverse proxy
            "sudo apt install nginx -y",
            "sudo systemctl start nginx",
            "sudo systemctl enable nginx",
            
            // Install Node.js and PM2 for process management
            "curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt install -y nodejs",
            "sudo npm install -g pm2",
            "pm2 startup systemd -u root --hp /root || true",
            
            // Verify installations
            'echo ".NET SDK: $(dotnet --version)"',
            'echo "Nginx: $(nginx -v 2>&1)"',
            'echo "Git: $(git --version)"',
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
