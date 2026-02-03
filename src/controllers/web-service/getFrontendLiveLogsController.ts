import { Context } from "elysia";
import { StatusCode } from "../../types/types";
import { db } from "../../db/client";
import { deployments } from "../../db/schema";
import { and, eq } from "drizzle-orm";
import pool from "../../db/pool";
import decryptVpsPassword from "../../utils/decryptPassword";
import SSHClient from "../../SSHClient/SSHClient";
import getRepoName from "../../repoActions/getRepoName";

const getLiveFrontendLogsController = async ({ params, set, userId }: Context | any) => {
    // Implementation for fetching frontend live logs
    const deploymentId = params.id;
    var ssh:SSHClient | null=null;
    try {
        // Logic to fetch and return live logs for the frontend deployment
        const project = await db.select().from(deployments).where(
            and(eq(deployments.deploymentId, deploymentId), eq(deployments.ownerId, userId))
        );
        
        if (!project || project.length === 0) {
            set.status = StatusCode.NOT_FOUND;
            return { message: "Project not found" };
        }
        
        const vpsMachine = await pool.query(
            `SELECT * FROM vps_machines WHERE vps_ip = $1 AND "ownerId" = $2`,
            [project[0].vpsIp, userId]
        );
        
        if (!vpsMachine.rows || vpsMachine.rows.length === 0) {
            set.status = StatusCode.NOT_FOUND;
            return { message: "VPS Machine not found" };
        }
        
        const hashedPassword = await decryptVpsPassword(vpsMachine.rows[0].vps_password);
        ssh = new SSHClient({
            username: "root",
            host: vpsMachine.rows[0].vps_ip,
            password: hashedPassword,
        });
        
        await ssh.connect();
        
        let repoName = getRepoName(project[0].repoUrl);
        if (project[0].subFolder && project[0].subFolder.trim() !== "") {
            repoName = `${repoName}/${project[0].subFolder}`;
        }
        //read files from frontend logs directory
        // Assuming logs are stored in $HOME/logs/frontend-logs/{deploymentId}.log
        const errorLog = await ssh.exec(`cat /var/log/nginx/${repoName}_error.log`);
        const accessLog = await ssh.exec(`cat /var/log/nginx/${repoName}_access.log`);
        console.log("Fetched frontend logs for deployment:", deploymentId);
        set.status = StatusCode.OK;
        return {
            message: "Frontend live logs fetched successfully",
            errorLog: errorLog.output,
            accessLog: accessLog.output
        };
    } catch (error) {
        set.status = StatusCode.INTERNAL_SERVER_ERROR;
        console.log("Error in getLiveFrontendLogsController", error);
        return {
            message: "Internal Server Error"
        };
    }finally{
        //ssh disconnect logic if needed
        if(ssh){
            ssh.close();
        }
    }
};
export default getLiveFrontendLogsController;