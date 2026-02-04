import { Context } from "elysia";
import { db } from "../../db/client";
import { vpsMachines } from "../../db/schema";
import { and, eq } from "drizzle-orm";
import { StatusCode } from "../../types/types";
import SSHClient from "../../SSHClient/SSHClient";
import decryptVpsPassword from "../../crypto/decryptVpsPassword";

/**
 * Get all used ports for a specific VPS machine via SSH
 * Returns an array of port numbers for instant frontend validation
 */
const getUsedPorts = async ({ params, set, userId }: Context | any) => {
    const vpsId: number = parseInt(params.id);
    const owner = parseInt(userId);
    let ssh: SSHClient | null = null;

    if (!vpsId || isNaN(vpsId)) {
        set.status = StatusCode.BAD_REQUEST;
        return {
            status: "error",
            message: "Invalid VPS ID"
        };
    }

    // Verify the machine belongs to the user
    const machines = await db
        .select()
        .from(vpsMachines)
        .where(and(eq(vpsMachines.ownerId, owner), eq(vpsMachines.id, vpsId)));

    if (machines.length === 0) {
        set.status = StatusCode.NOT_FOUND;
        return {
            status: "error",
            message: "Machine not found or unauthorized"
        };
    }

    const vpsMachine = machines[0];
    const decryptedPassword = decryptVpsPassword(vpsMachine.vps_password);

    try {
        ssh = new SSHClient({
            host: vpsMachine.vps_ip,
            username: "root",
            password: decryptedPassword
        });
        await ssh.connect();
        // Get all listening ports using ss (socket statistics)
        // -t: TCP, -u: UDP, -l: listening, -n: numeric ports
        const result = await ssh.exec(
            "ss -tuln | awk 'NR>1 {print $5}' | grep -oP '(?<=:)[0-9]+$' | sort -n | uniq"
        );
        const usedPorts: number[] = result.output
            .trim()
            .split("\n")
            .filter((port: string) => port !== "")
            .map((port: string) => parseInt(port, 10))
            .filter((port: number) => !isNaN(port));

        set.status = StatusCode.OK;
        return {
            status: "success",
            data: {
                vpsId,
                usedPorts
            }
        };
    } catch (error) {
        set.status = StatusCode.INTERNAL_SERVER_ERROR;
        return {
            status: "error",
            message: "Failed to fetch used ports from machine",
            error: (error as Error).message
        };
    } finally {
        if (ssh) {
            ssh.close();
        }
    }
};

export default getUsedPorts;
