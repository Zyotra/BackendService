import SSHClient from "../SSHClient/SSHClient";

const dockerDepedenciesInstaller = async (ssh: SSHClient): Promise<boolean> => {
    try {
        const dockerInstallCommands = [
            "sudo apt update",
            "sudo apt install -y ca-certificates curl gnupg lsb-release",
            "sudo install -m 0755 -d /etc/apt/keyrings",
            "curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg || true",
            "sudo chmod a+r /etc/apt/keyrings/docker.gpg",
            "echo \"deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable\" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null",
            "sudo apt update",
            "sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin",
            "sudo systemctl start docker",
            "sudo systemctl enable docker",
            "sudo docker --version",
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