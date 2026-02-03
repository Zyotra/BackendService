import SSHClient from "../SSHClient/SSHClient";
import socketManager from "../ws/socketManager";
import { saveLog } from "./saveLog";

const injectNginxConfig = async (
    ssh: SSHClient,
    nginxConfig: string,
    domain: string,
    deploymentId: string
): Promise<boolean> => {
    try {
        const destinationPath = `/etc/nginx/sites-available/${domain}`;
        const linkPath = `/etc/nginx/sites-enabled/${domain}`;
        console.log("Injecting nginx config...");

        if (!nginxConfig || nginxConfig.trim().length === 0) {
            console.log("Empty nginx config provided. Skipping.");
            return true;
        }
        let safeContent = nginxConfig.replace(/\\/g, "\\\\");
        safeContent = safeContent.replace(/"/g, '\\"');
        safeContent = safeContent.replace(/\$/g, "\\$");
        safeContent = safeContent.replace(/\n/g, "\\n");
        const commands = [`printf "${safeContent}" | sudo tee ${destinationPath} > /dev/null`
            , `sudo rm -f ${linkPath}`,
        `sudo ln -s ${destinationPath} ${linkPath}`,
            `sudo nginx -t`,
            `sudo systemctl reload nginx`
        ];
        await saveLog(deploymentId, `Injecting nginx config to ${destinationPath} and reloading nginx...`, ssh)
        const result = await ssh.runSequential(commands, async (logChunk) => {
            console.log("SSH Log:", logChunk);
            await saveLog(deploymentId, logChunk, ssh)
            await socketManager.emitLog(deploymentId, logChunk);
        });
        console.log("Nginx config written successfully.", result);
        return true;
    } catch (error) {
        console.error("Error injecting nginx config:", error);
        return false;
    }
};

export default injectNginxConfig;
