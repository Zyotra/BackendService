import SSHClient from "../SSHClient/SSHClient";
import socketManager from "../ws/socketManager";
import { saveLog } from "./saveLog";

const cloneRepo = async (ssh: SSHClient, repoUrl: string, deploymentId: string): Promise<boolean> => {
    try {
        console.log("Starting to clone repository:", repoUrl);
        // Disable SSH host key verification to avoid issues with first-time connections
        const commands = [
            `git config --global core.sshCommand 'ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null'`,
            `git clone ${repoUrl} 2>&1`
        ];
        await saveLog(deploymentId, `Cloning repository: ${repoUrl}`, ssh)
        await ssh.runSequential(commands, async (logChunk: string) => {
            console.log("Clone log:", logChunk);
            await saveLog(deploymentId, logChunk, ssh)
            await socketManager.emitLog(deploymentId, logChunk);
        });
        console.log("Repository cloned successfully.");
        return true;
    } catch (error) {
        console.log("Error in cloneRepo:", error);
        return false;
    }
}
export default cloneRepo;