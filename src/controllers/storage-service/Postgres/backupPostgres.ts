import { Context } from "elysia";
import SSHClient from "../../../SSHClient/SSHClient";
import { PostgresSSHHelper } from "../../../HelperClasses/PostgresHelper";
import { verifyMachine } from "../MySQL/deployMySQL";
import decryptVpsPassword from "../../../utils/decryptPassword";
import { StatusCode } from "../../../types/types";

const backupPostgres = async ({ body, set, userId }: Context | any) => {
    const req = body as { userName: string, password: string, dbName: string, vpsId: string, vpsIp: string };
    const { userName, dbName, vpsId, vpsIp } = req;
    
    // Validate required fields
    if (!userName || !dbName || !vpsId || !vpsIp) {
        set.status = StatusCode.BAD_REQUEST
        return {
            status: "error",
            message: "Missing required fields: userName, dbName, vpsId, and vpsIp are required"
        }
    }
    
    var pgHelper: PostgresSSHHelper | null = null;
    var ssh: SSHClient | null = null
    try {
        const isMachineVerified = await verifyMachine(vpsId, userId, vpsIp)
        const { machine } = isMachineVerified;
        if (!machine) {
            set.status = StatusCode.FORBIDDEN
            return {
                message: "Machine verification failed"
            }
        }
        const hashedPassword = await decryptVpsPassword(machine.vps_password)
        ssh = new SSHClient({
            username: "root",
            host: vpsIp,
            password: hashedPassword
        })
        await ssh.connect()
        pgHelper = new PostgresSSHHelper(ssh)
        const backupResult = await pgHelper.backupDatabase(dbName, userName)
        set.status = StatusCode.OK
        return {
            status: "success",
            message: backupResult.message,
            backupPath: backupResult.backupPath
        }
    } catch (error) {
        set.status = StatusCode.INTERNAL_SERVER_ERROR
        return {
            status: "error",
            message: error instanceof Error ? error.message : String(error)
        }
    } finally {
        if (ssh) {
            await ssh.close()
        }
    }
};
export default backupPostgres
