import SSHClient from "../SSHClient/SSHClient";
import socketManager from "../ws/socketManager";
import { saveLog } from "./saveLog";

const enableSSLDomain = async (ssh: SSHClient, domain: string, deploymentId: string) => {
    try {
        // First, test and reload nginx to make sure base config works
        const preCommands = [
            `sudo nginx -t && sudo systemctl reload nginx`,
            `sudo DEBIAN_FRONTEND=noninteractive apt-get install -y certbot python3-certbot-nginx 2>/dev/null || true`,
        ];
        
        await saveLog(deploymentId, `Enabling domain ${domain} with SSL using Certbot...`, ssh);
        
        // Run pre-commands without heavy logging to avoid SSH channel exhaustion
        await ssh.runSequential(preCommands, (logChunk) => {
            console.log("SSL Setup:", logChunk);
        });
        
        // Run certbot separately with better error handling
        const certbotCommand = [
            `sudo certbot --nginx -d ${domain} --non-interactive --agree-tos --register-unsafely-without-email --redirect 2>&1 || echo "Certbot failed, continuing without SSL"`
        ];
        
        await ssh.runSequential(certbotCommand, (logChunk) => {
            console.log("Certbot Log:", logChunk);
            // Don't await saveLog here to avoid SSH channel issues
            socketManager.emitLog(deploymentId, logChunk);
        });
        
        // Final nginx reload
        await ssh.runSequential([`sudo systemctl reload nginx || true`], () => {});
        
        return true;
    } catch (error) {
        console.error("Error in enableDomain:", error);
        // Return true anyway to not block deployment if SSL fails
        // The site will still work on HTTP
        return true;
    }
}
export default enableSSLDomain;