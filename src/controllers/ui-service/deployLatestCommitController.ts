import { Context } from "elysia";
import { StatusCode } from "../../types/types";
import getMachineDetail from "../../utils/getMachineDetail";
import SSHClient from "../../SSHClient/SSHClient";
import getRepoName from "../../repoActions/getRepoName";
import { saveLog } from "../../repoActions/saveLog";
import decryptVpsPassword from "../../utils/decryptPassword";
import copyAssets from "../../repoActions/copyAssets";
import socketManager from "../../ws/socketManager";
import { db } from "../../db/client";
import { deployments } from "../../db/schema";
import { eq } from "drizzle-orm";
import { and } from "drizzle-orm";
const deployLatestCommitFrontendController = async ({ set, params, userId }: Context | any) => {
    try {
        const deploymentId = params.id;
        if (!deploymentId) {
            set.status = StatusCode.BAD_REQUEST
            return {
                status: "error",
                message: "Missing deploymentId"
            }
        }
        console.log("Deploying latest commit (Frontend) for deployment ID:", deploymentId, "by user ID:", userId);
        const deploymentRecord = await db.select().from(deployments).where(and(eq(deployments.deploymentId, deploymentId), eq(deployments.ownerId, userId))).limit(1);
        if (deploymentRecord.length === 0) {
            set.status = StatusCode.NOT_FOUND
            return {
                status: "error",
                message: "Deployment record not found"
            }
        }
        console.log("Fetched deployment record:", deploymentRecord[0]);
        const vpsMachine = await getMachineDetail(deploymentRecord[0].vpsIp, userId.toString());
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
        let dirName = getRepoName(deploymentRecord[0].repoUrl);
        const sub_folder = deploymentRecord[0].subFolder;
        if (sub_folder && sub_folder.trim() != "") {
            dirName = `${dirName}/${sub_folder}`;
        }

        const outDir = (deploymentRecord[0] as any).outDir || "dist";
        const framework = deploymentRecord[0].framework || "";
        
        let commands;
        
        if (framework.toLowerCase() === "plainhtml" || framework.toLowerCase() === "htmlcssjs" || framework.toLowerCase() === "html") {
            // For plain HTML, just pull and copy assets
            commands = [
                `cd ${dirName} && git pull origin main`
            ];
            
            await saveLog(deploymentId, `Deploying plain HTML with commands:\n${commands.join('\n')}\n`, ssh);
            socketManager.emitLog(deploymentId, `Deploying plain HTML with commands:\n${commands.join('\n')}\n`);
            
            await ssh.runSequential(commands, async (logChunk) => {
                await saveLog(deploymentId, logChunk, ssh);
                socketManager.emitLog(deploymentId, logChunk);
            });
            
            await saveLog(deploymentId, `Copying assets to deployment directory...\n`, ssh);
            socketManager.emitLog(deploymentId, `Copying assets to deployment directory...\n`);
            const isRepoCopied = await copyAssets(ssh, dirName, "", deploymentId);
            if (!isRepoCopied) {
                set.status = StatusCode.INTERNAL_SERVER_ERROR
                return {
                    status: "error",
                    message: "Failed to copy assets to the deployment directory."
                }
            }
        } else {
            // For frameworks like React, Vue, etc.
            let packageInstallerCmd = deploymentRecord[0].packageInstallerCommand;
            let buildCmd = deploymentRecord[0].buildCommand;
            
            // If commands are empty, use defaults based on framework
            if (!packageInstallerCmd || packageInstallerCmd.trim() === "") {
                packageInstallerCmd = "npm install";
            }
            if (!buildCmd || buildCmd.trim() === "") {
                buildCmd = "npm run build";
            }
            
            // Has build commands - run full build pipeline
            commands = [
                `cd ${dirName} && git pull origin main`,
                `cd ${dirName} && ${packageInstallerCmd}`,
                `cd ${dirName} && ${buildCmd}`
            ];
            
            await saveLog(deploymentId, `Deploying frontend with commands:\n${commands.join('\n')}\n`, ssh);
            socketManager.emitLog(deploymentId, `Deploying frontend with commands:\n${commands.join('\n')}\n`);
            
            await ssh.runSequential(commands, async (logChunk) => {
                await saveLog(deploymentId, logChunk, ssh);
                socketManager.emitLog(deploymentId, logChunk);
            });
            
            await saveLog(deploymentId, `Copying build artifacts to deployment directory...\n`, ssh);
            socketManager.emitLog(deploymentId, `Copying build artifacts to deployment directory...\n`);
            const isRepoCopied = await copyAssets(ssh, dirName, outDir, deploymentId);
            if (!isRepoCopied) {
                set.status = StatusCode.INTERNAL_SERVER_ERROR
                return {
                    status: "error",
                    message: "Failed to copy build assets to the deployment directory."
                }
            }
        }
        
        // Reload nginx to serve updated files
        await saveLog(deploymentId, `Reloading nginx...\n`, ssh);
        socketManager.emitLog(deploymentId, `Reloading nginx...\n`);
        const nginxResult = await ssh.exec(`nginx -s reload || systemctl reload nginx`);
        await saveLog(deploymentId, nginxResult.output, ssh);
        socketManager.emitLog(deploymentId, nginxResult.output);
        
        await saveLog(deploymentId, `✅ Frontend deployment completed successfully!\n`, ssh);
        socketManager.emitLog(deploymentId, `✅ Frontend deployment completed successfully!\n`);
        console.log("Frontend deployment commands executed successfully on VPS for deployment ID:", deploymentId);
        
        return {
            status: "success",
            message: "Frontend deployment initiated"
        }
    } catch (error) {
        console.error("Error in deployLatestCommitFrontendController:", error);
        set.status = StatusCode.INTERNAL_SERVER_ERROR
        return {
            status: "error",
            message: "Internal Server Error"
        }
    }
}

export default deployLatestCommitFrontendController