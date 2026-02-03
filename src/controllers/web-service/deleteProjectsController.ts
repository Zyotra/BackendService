import { eq, and } from "drizzle-orm";
import { Context } from "elysia";
import { activityLogs, deployments } from "../../db/schema";
import { db } from "../../db/client";
import { StatusCode } from "../../types/types";
import pool from "../../db/pool";
import getMachineDetail from "../../utils/getMachineDetail";
import SSHClient from "../../SSHClient/SSHClient";
import getRepoName from "../../repoActions/getRepoName";
import { enc } from "crypto-js";
import decryptVpsPassword from "../../utils/decryptPassword";
import unLinkDomain from "../../db/unlinkDomain";

const deleteProjectsController = async ({ set, params, userId }: Context | any) => {
    try {
        const projectId = params.id;
        if (!projectId) {
            set.status = 400
            return {
                status: "error",
                message: "Missing projectId"
            }
        }
        console.log("Deleting project with ID:", projectId);
        const project = await db.select().from(deployments).where(and(eq(deployments.id, projectId), eq(deployments.ownerId, userId))).limit(1);
        if (project.length === 0) {
            set.status = StatusCode.NOT_FOUND
            return {
                status: "error",
                message: "Project not found"
            }
        }
        const vps_ip = project[0].vpsIp;
        const domain = project[0].domain;
        const repo_Url = project[0].repoUrl;
        console.log("Fetched project details:", project[0], userId);
        const vpsMachine = await getMachineDetail(vps_ip, userId.toString());
        console.log("Fetched VPS Machine details for deletion:", vpsMachine);
        if (!vpsMachine || vpsMachine === null) {
            set.status = StatusCode.NOT_FOUND
            return {
                status: "error",
                message: "VPS Machine not found"
            }
        }
        console.log("VPS Machine details fetched:", vpsMachine);
        const ssh = new SSHClient({
            host: vpsMachine.vps_ip,
            port: 22,
            username: "root",
            password: await decryptVpsPassword(vpsMachine.vps_password)
        })
        await ssh.connect();
        console.log("SSH Connected to VPS for deletion:", vpsMachine.vps_ip);
        let repoDir = getRepoName(repo_Url);
        let dirName = getRepoName(repo_Url);
        const sub_folder = project[0].subFolder;
        console.log("Sub folder for project:", sub_folder);
        if (sub_folder && sub_folder.trim() != "") {
            dirName = `${dirName}/${sub_folder}`;
        }
        let commands;
        if (project[0].projectType.toLowerCase() == "webservice") {
            console.log("Preparing deletion commands for web service project.", dirName, domain);
            const framework = project[0].framework.toLowerCase();
            
            if (framework === "docker") {
                const domain = project[0].domain;
                commands = [
                    `docker stop ${domain.replace(/\./g, '_')}_container || true`,
                    `docker rm ${domain.replace(/\./g, '_')}_container || true`,
                    `rm -rf ${repoDir}`,
                    `sudo rm -f /etc/nginx/sites-enabled/${domain}`,
                    `sudo rm -f /etc/nginx/sites-available/${domain}`,
                    `sudo nginx -t && sudo nginx -s reload`
                ]
            } else if (framework === "django" || framework === "flask") {
                commands = [
                    `pm2 delete ${dirName} || true`,
                    `pm2 save`,
                    `rm -rf ${repoDir}`,
                    `sudo rm -f /etc/nginx/sites-enabled/${domain}`,
                    `sudo rm -f /etc/nginx/sites-available/${domain}`,
                    `sudo nginx -t && sudo nginx -s reload`
                ]
            } else if (framework === "spring-boot" || framework === "rust" || framework === "go") {
                // These might not use pm2, but try to delete anyway
                commands = [
                    `pm2 delete ${dirName} || true`,
                    `pm2 save`,
                    `pkill -f "${repoDir}" || true`,
                    `rm -rf ${repoDir}`,
                    `sudo rm -f /etc/nginx/sites-enabled/${domain}`,
                    `sudo rm -f /etc/nginx/sites-available/${domain}`,
                    `sudo nginx -t && sudo nginx -s reload`
                ] 
            } else {
                // Default: Node.js, Bun, Elysia, etc. (pm2-based)
                commands = [
                    `pm2 delete ${dirName} || true`,
                    `pm2 save`,
                    `rm -rf ${repoDir}`,
                    `sudo rm -f /etc/nginx/sites-enabled/${domain}`,
                    `sudo rm -f /etc/nginx/sites-available/${domain}`,
                    `sudo nginx -t && sudo nginx -s reload`
                ]
            }
        } else if (project[0].projectType.toLowerCase() == "ui") {
            commands = [
                `rm -rf ${repoDir}`,
                `sudo rm -rf /var/www/${repoDir}`,
                `sudo rm -f /etc/nginx/sites-enabled/${domain}`,      // Symlink first
                `sudo rm -f /etc/nginx/sites-available/${domain}`,    // Actual file second
                `sudo nginx -t && sudo nginx -s reload`                // Test before reload
            ]
        }
        if (!commands || commands.length === 0) {
            set.status = StatusCode.BAD_REQUEST;
            return {
                status: "error",
                message: "Unknown project type. Cannot delete project."
            };
        }
        console.log("Executing deletion commands on VPS:", commands);
        await ssh.runSequential(commands, (logChunk: string) => {
            console.log("Deletion log:", logChunk);
        });
        console.log("Web service and related configurations deleted from VPS:", vpsMachine.vps_ip);
        await db.insert(activityLogs).values({
            deploymentId: project[0].deploymentId,
            userId: userId,
            domain_address: domain,
            log: "Deleted project with domain " + domain + " and repository " + repo_Url + "on machine " + vps_ip,
        })
        await db.delete(deployments).where(eq(deployments.id, projectId));
        console.log("Project record deleted from database for project ID:", projectId);
        await unLinkDomain(domain);
        console.log("Domain unlinked successfully:", domain);
        set.status = StatusCode.OK;
        return {
            status: "success",
            message: "Project deleted successfully"
        };

    } catch (error) {
        console.error("Error deleting project:", error);
        set.status = StatusCode.INTERNAL_SERVER_ERROR;
        return {
            status: "error",
            message: "Failed to delete project",
            error
        };
    }
}
export default deleteProjectsController;