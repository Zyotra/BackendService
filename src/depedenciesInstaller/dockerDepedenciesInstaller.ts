import SSHClient from "../SSHClient/SSHClient";

const dockerDepedenciesInstaller = async (ssh: SSHClient): Promise<boolean> => {
    try {
        const dockerInstallCommands = [
            // Install Docker (all in one batch operation)
            `sudo apt update && \
sudo apt install -y ca-certificates curl gnupg lsb-release build-essential --no-install-recommends && \
sudo install -m 0755 -d /etc/apt/keyrings && \
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null || true && \
sudo chmod a+r /etc/apt/keyrings/docker.gpg && \
echo "deb [arch=\$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \$(lsb_release -cs) stable" | \
sudo tee /etc/apt/sources.list.d/docker.list > /dev/null && \
sudo apt update --fix-missing && \
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin --no-install-recommends`,

            // Start and enable Docker service
            "sudo systemctl start docker && sudo systemctl enable docker",

            // Create necessary symlinks if needed
            "which docker > /dev/null 2>&1 || sudo ln -sf /usr/bin/docker /usr/local/bin/docker || true",

            // Verify installation
            "echo '=== Docker Installation Complete ===' && docker --version && docker compose version",
        ];
        
        await ssh.runSequential(dockerInstallCommands, (logChunk) => {
            console.log("Docker Install Log:", logChunk);
        });
        return true;
    } catch (error) {
        console.log("Error in dockerDepedenciesInstaller:", error);
        return false;
    }
}
export default dockerDepedenciesInstaller;