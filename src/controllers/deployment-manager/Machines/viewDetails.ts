import { Context } from "elysia"
import { db } from "../../../db/client";
import { vpsMachines } from "../../../db/schema";
import { eq } from "drizzle-orm";
import { StatusCode } from "../../../types/types";
import SSHClient from "../../../SSHClient/SSHClient";
import decryptVpsPassword from "../../../crypto/decryptVpsPassword";
const viewDetails = async ({ params, set }: Context) => {
    var ssh: SSHClient | null = null;
    try {
        const machineId = params.id;
        const machine = await db.select().from(vpsMachines).where(eq(vpsMachines.id, Number(machineId))).limit(1);
        set.status = StatusCode.NOT_FOUND
        if (machine.length === 0) {
            return {
                message: "No machine found with the provided ID",
            }
        }
        ssh = new SSHClient({
            host: machine[0].vps_ip,
            username: "root",
            password: await decryptVpsPassword(machine[0].vps_password),
            port: 22,
        })
        await ssh.connect();
        const commands = [
            `free -m`,
            `df -h`,
            `cat /proc/cpuinfo | grep 'model name' | uniq`,
            `hostnamectl | grep 'Operating System'`,
            `top -b -n 1`
        ]
        const results = await ssh.runSequential(commands);
        const details = {
            memory: results[0].output,
            disk: results[1].output,
            cpu: results[2].output,
            os: results[3].output,
            processes: results[4].output,
        }
        set.status = StatusCode.OK
        return {
            message: "Machine details fetched successfully",
            data: details,
        };
    } catch (error) {
        console.error("Error in viewDetails:", error);
        set.status = StatusCode.INTERNAL_SERVER_ERROR
        return {
            message: "An error occurred while fetching machine details",
            error,
        }
    } finally {
        if (ssh) {
            ssh.close();
        }
    }



}
export default viewDetails;