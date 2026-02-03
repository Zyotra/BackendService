import { Context } from "elysia";
import { StatusCode } from "../../../types/types";
import { db } from "../../../db/client";
import { and, eq } from "drizzle-orm";
import { githubAuths, vpsMachines } from "../../../db/schema";
import SSHClient from "../../../SSHClient/SSHClient";
import decryptVpsPassword from "../../../crypto/decryptVpsPassword";
const authenticateGithubController = async ({ body, params, userId, set }: Context | any) => {
    const vpsId = params.id;
    const req = body as {
        githubUsername: string,
        githubToken: string,
    }
    const username = req.githubUsername;
    const token = req.githubToken;
    if (!vpsId || !userId || !username || !token) {
        set.status = StatusCode.BAD_REQUEST
        return {
            status: "error",
            message: "Missing required fields"
        }
    }
    var ssh: SSHClient | null = null
    try {
        const vps = await db.select().from(vpsMachines).where(and(eq(vpsMachines.id, vpsId), eq(vpsMachines.ownerId, userId)))
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
        const commands = [
            `sudo apt install -y git curl`,
            // Validate token AND verify username
            `curl -f -s -H "Authorization: token ${token}" https://api.github.com/users/${username} > /dev/null || (echo "Invalid GitHub username or token" && exit 1)`,
            // Store credentials
            `git config --global credential.helper store`,
            `echo "https://${username}:${token}@github.com" > ~/.git-credentials`,
            `chmod 600 ~/.git-credentials`
        ];
        await ssh.runSequential(commands)
        await db.insert(githubAuths).values({
            vpsId: vpsId,
            github_username: username
        })
        set.status = StatusCode.OK;
        return {
            status: "success",
            message: "VPS authenticated successfully"
        }
    } catch (error) {
        const deleteCmds = [
            `sudo rm -f ~/.git-credentials || true`,
            `git config --global --unset credential.helper || true`
        ];
        await ssh?.runSequential(deleteCmds);
        set.status = StatusCode.INTERNAL_SERVER_ERROR;
        return {
            status: "error",
            message: "Failed to authenticate VPS with GitHub",
            error: (error as Error).message
        }
    } finally {
        if (ssh) {
            await ssh.close();
        }
    }
}

export default authenticateGithubController;