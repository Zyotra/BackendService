import { Context } from "elysia";
import { StatusCode } from "../../../types/types";
import SSHClient from "../../../SSHClient/SSHClient";
import decryptVpsPassword from "../../../crypto/decryptVpsPassword";
import { db } from "../../../db/client";
import { githubAuths, vpsMachines } from "../../../db/schema";
import { and, eq } from "drizzle-orm";

const unauthenticateGithubController = async ({ params, userId, set }: Context | any) => {
    const vpsId = params.id;
    var ssh: SSHClient | null = null
    if (!vpsId || !userId) {
        set.status = StatusCode.BAD_REQUEST;
        return {
            status: "error",
            message: "Missing required fields"
        }
    }
    try {
        const vps = await db.select({
            vps_password:vpsMachines.vps_password,
            vps_ip:vpsMachines.vps_ip
        }).from(vpsMachines).where(and(eq(vpsMachines.id, vpsId), eq(vpsMachines.ownerId, userId)))
        if (vps.length === 0) {
            set.status = StatusCode.NOT_FOUND;
            return {
                status: "error",
                message: "Unauthorized or VPS not found"
            }
        }
        // Further authentication logic with GitHub can be added here
        const encryptedPassword = await decryptVpsPassword(vps[0].vps_password);
        ssh = new SSHClient({
            host: vps[0].vps_ip,
            username: "root",
            password: encryptedPassword
        });
        await ssh.connect();
        const deleteCmds = [
            `sudo rm -f ~/.git-credentials || true`,
            `git config --global --unset credential.helper || true`
        ];
        await ssh.runSequential(deleteCmds);
        await db.delete(githubAuths).where(eq(githubAuths.vpsId, vpsId));
        set.status = StatusCode.OK;
        return {
            status: "success",
            message: "VPS unauthenticated from GitHub successfully"
        }
    } catch (error) {
        set.status = StatusCode.INTERNAL_SERVER_ERROR;
        return {
            status: "error",
            message: "Failed to unauthenticate VPS from GitHub",
            error: (error as Error).message
        }
    } finally {
        if (ssh) {
            await ssh.close();
        }
    }

}
export default unauthenticateGithubController;