import { Context } from "elysia";
import { db } from "../../db/client";
import { deployments } from "../../db/schema";
import { and, eq } from "drizzle-orm";
import { StatusCode } from "../../types/types";
import pool from "../../db/pool";
import SSHClient from "../../SSHClient/SSHClient";
import decryptVpsPassword from "../../utils/decryptPassword";

const getDeploymentLogController = async ({ params, set, userId }: Context | any) => {
    var ssh:SSHClient | null=null;
    try {
        const deploymentId = params.id
        const project = await db.select().from(deployments).where(and(eq(deployments.deploymentId, deploymentId), eq(deployments.ownerId, userId)))
        if (!project || project.length === 0) {
            set.status = StatusCode.NOT_FOUND
            return {
                message: "Project not found"
            }
        }
        const vpsMachine = await pool.query(`SELECT * FROM vps_machines WHERE vps_ip = $1 AND "ownerId" = $2`, [project[0].vpsIp, userId])
        if (!vpsMachine.rows || vpsMachine.rows.length === 0) {
            set.status = StatusCode.NOT_FOUND
            return {
                message: "VPS Machine not found"
            }
        }
        const hashedPassword = await decryptVpsPassword(vpsMachine.rows[0].vps_password)
        ssh = new SSHClient({
            username: "root",
            host: vpsMachine.rows[0].vps_ip,
            password: hashedPassword,
            tryKeyboard: true
        })
        console.log(`Attempting SSH connection to ${vpsMachine.rows[0].vps_ip} with password length: ${vpsMachine.rows[0].vps_password?.length}`)
        await ssh.connect()
        const log = await ssh.exec(`cat $HOME/logs/webservice-logs/${deploymentId}.log`)
        set.status = StatusCode.OK
        return {
            message: "success",
            log: log.output
        }
    } catch (error) {
        set.status = StatusCode.INTERNAL_SERVER_ERROR
        console.log("Error in getLiveLogController", error)
        return {
            message: "Internal Server Error"
        }
    }finally{
        if(ssh){
            ssh.close();
        }
    }
}
export default getDeploymentLogController