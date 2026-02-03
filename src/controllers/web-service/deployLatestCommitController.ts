import { Context } from "elysia";
import { StatusCode } from "../../types/types";
import { db } from "../../db/client";
import { deployments } from "../../db/schema";
import { and, eq } from "drizzle-orm";
import getMachineDetail from "../../utils/getMachineDetail";
import SSHClient from "../../SSHClient/SSHClient";
import getRepoName from "../../repoActions/getRepoName";
import { saveLog } from "../../repoActions/saveLog";
import decryptVpsPassword from "../../utils/decryptPassword";

const deployLatestCommitController = async ({ set, params, userId }: Context | any) => {
    try {
        const deploymentId = params.id;
        if (!deploymentId) {
            set.status = StatusCode.BAD_REQUEST
            return {
                status: "error",
                message: "Missing deploymentId"
            }
        }
        console.log("Deploying latest commit for deployment ID:", deploymentId, "by user ID:", userId);
        const delploymentRecord = await db.select().from(deployments).where(and(eq(deployments.deploymentId, deploymentId), eq(deployments.ownerId, userId))).limit(1);
        if (delploymentRecord.length === 0) {
            set.status = StatusCode.NOT_FOUND
            return {
                status: "error",
                message: "Deployment record not found"
            }
        }
        console.log("Fetched deployment record:", delploymentRecord[0]);
        const vpsMachine = await getMachineDetail(delploymentRecord[0].vpsIp, userId.toString());
        if (!vpsMachine || vpsMachine === null) {
            set.status = StatusCode.NOT_FOUND
            return {
                status: "error",
                message: "VPS Machine not found"
            }
        }
        console.log("VPS Machine details fetched for deployment:", vpsMachine);
        const vps_ip = vpsMachine.vps_ip;
        const vps_password = vpsMachine.vps_password;
        const hashedPassword = await decryptVpsPassword(vps_password);
        const ssh = new SSHClient({
            host: vps_ip,
            password: hashedPassword,
            username: "root"
        })
        await ssh.connect();
        console.log("SSH Connected to VPS for deployment:", vps_ip);
        let dirName = getRepoName(delploymentRecord[0].repoUrl);
        const sub_folder = delploymentRecord[0].subFolder;
        if (sub_folder && sub_folder.trim() != "") {
            dirName = `${dirName}/${sub_folder}`;
        }
        let gitCommands;
        if (delploymentRecord[0].framework.toLowerCase() === "docker") {
            const readEnvData=await ssh.exec(`cat ${dirName}/.env || echo ""`);
            const envLines=readEnvData.output.split("\n");
            const env: Record<string, string> = {};
            envLines.forEach(line => {
                const [key, value] = line.split("=");
                if (key && value) {
                    env[key.trim()] = value.trim();
                }
            });
            // Chain commands with && to run in same shell session
            gitCommands=[
                `cd ${dirName} && git pull origin main`,
                `cd ${dirName} && docker stop ${delploymentRecord[0].domain.replace(/\./g, '_')}_container || true`,
                `cd ${dirName} && docker rm ${delploymentRecord[0].domain.replace(/\./g, '_')}_container || true`,
                `cd ${dirName} && docker build -t ${delploymentRecord[0].domain.replace(/\./g, '_')}_image .`,
                `docker run -d -p ${env["PORT"]}:${env["CONTAINER_PORT"]} --env-file ${dirName}/.env --name ${delploymentRecord[0].domain.replace(/\./g, '_')}_container ${delploymentRecord[0].domain.replace(/\./g, '_')}_image` 
            ]
        }
        else {
            // Check if it's a Python project
            const isPythonProject = delploymentRecord[0]?.packageInstallerCommand?.includes('pip') || delploymentRecord[0]?.packageInstallerCommand?.includes('python');
            
            if (isPythonProject) {
                // Python project - use venv and user's package installer command
                gitCommands = [
                    `cd ${dirName} && git pull origin main`,
                    // Recreate venv if needed
                    `cd ${dirName} && (test -d venv || python3 -m venv venv)`,
                    // Use user's packageInstallerCommand with venv activation
                    `cd ${dirName} && source venv/bin/activate && ${delploymentRecord[0].packageInstallerCommand}`,
                    delploymentRecord[0].buildCommand ? `cd ${dirName} && source venv/bin/activate && ${delploymentRecord[0].buildCommand}` : undefined,
                    `pm2 restart ${dirName}`
                ].filter(Boolean) as string[];
            } else {
                // Non-Python project
                gitCommands = [
                    `cd ${dirName} && git pull origin main`,
                    `cd ${dirName} && ${delploymentRecord[0].packageInstallerCommand}`,
                    delploymentRecord[0].buildCommand ? `cd ${dirName} && ${delploymentRecord[0].buildCommand}` : undefined,
                    `pm2 restart ${dirName}`
                ].filter(Boolean) as string[];
            }
        }
        console.log("Executing git commands on VPS:", gitCommands);
        await saveLog(deploymentId, `Deploying latest commit with commands:\n${gitCommands.join('\n')}\n`, ssh);
        await ssh.runSequential(gitCommands, async (logChunk) => {
            await saveLog(deploymentId, logChunk, ssh);
        });
        console.log("Git commands executed successfully on VPS for deployment ID:", deploymentId);
        return {
            status: "success",
            message: "Deployment initiated"
        }
    } catch (error) {
        console.error("Error in deployLatestCommitController:", error);
        set.status = StatusCode.INTERNAL_SERVER_ERROR
        return {
            status: "error",
            message: "Internal Server Error"
        }
    }
}

export default deployLatestCommitController;