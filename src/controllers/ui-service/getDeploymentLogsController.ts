import { Context } from "elysia";
import { db } from "../../db/client";
import { deployments, vpsMachines } from "../../db/schema";
import { and, eq } from "drizzle-orm";
import { StatusCode } from "../../types/types";
import SSHClient from "../../SSHClient/SSHClient";

const getDeploymentLogController = async ({ params, set, userId }: Context | any) => {
    try {
        const deploymentId = params.id
        const project = await db.select().from(deployments).where(and(eq(deployments.id, deploymentId), eq(deployments.ownerId, userId)))
        if (!project || project.length === 0) {
            set.status = StatusCode.NOT_FOUND
            return {
                message: "Project not found"
            }
        }
        const vpsMachine = await db.select().from(vpsMachines).where(and(eq(vpsMachines.vps_ip, project[0].vpsIp), eq(vpsMachines.ownerId, userId)))
        if (!vpsMachine || vpsMachine.length === 0) {
            set.status = StatusCode.NOT_FOUND
            return {
                message: "VPS Machine not found"
            }
        }
        const ssh = new SSHClient({
            username: "root",
            host: vpsMachine[0].vps_ip,
            password: vpsMachine[0].vps_password
        })
        const log = await ssh.exec(`cat $HOME/logs/ui-logs/${deploymentId}.log`)
        set.status = StatusCode.OK
        return {
            message: "success",
            log: log
        }
    } catch (error) {
        set.status = StatusCode.INTERNAL_SERVER_ERROR
        console.log("Error in getLiveLogController", error)
        return {
            message: "Internal Server Error"
        }
    }
}
export default getDeploymentLogController