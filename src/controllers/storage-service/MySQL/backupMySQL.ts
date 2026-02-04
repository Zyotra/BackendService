import { Context } from "elysia";
import MySQLHelper from "../../../HelperClasses/mySQLHelper";
import SSHClient from "../../../SSHClient/SSHClient";
import { verifyMachine } from "./deployMySQL";
import decryptVpsPassword from "../../../utils/decryptPassword";
import { StatusCode } from "../../../types/types";
import { backups, deployed_db } from "@/db/schema";
import { db } from "@/db/client";
import { and, eq } from "drizzle-orm";

const backupMySQL = async ({ body, set, userId }: Context | any) => {
    const req = body as { userName: string, password: string, dbName: string, vpsId: string, vpsIp: string };
    const { userName, password, dbName, vpsId, vpsIp } = req;
    
    // Validate required fields
    if (!userName || !password || !dbName || !vpsId || !vpsIp) {
        set.status = StatusCode.BAD_REQUEST
        return {
            status: "error",
            message: "Missing required fields: userName, password, dbName, vpsId, and vpsIp are required"
        }
    }
    
    var sqlHelper: MySQLHelper | null = null;
    var ssh: SSHClient | null = null
    try {
        const isMachineVerified = await verifyMachine(vpsId, userId, vpsIp)
        const { machine } = isMachineVerified;
        if(!machine){
            set.status = StatusCode.NOT_FOUND
            return {
                status: "error",
                message: "VPS Machine not found"
            }
        }
        const hashedPassword = await decryptVpsPassword(machine.vps_password)
        ssh = new SSHClient({
            username: "root",
            host: vpsIp,
            password: hashedPassword
        })
        await ssh.connect()
        sqlHelper = new MySQLHelper(ssh);
        
        // Check if database exists
        const dbExists = await db.select().from(deployed_db).where(and(eq(deployed_db.dbName, dbName), eq(deployed_db.vpsId, parseInt(vpsId))));
        if (!dbExists || dbExists.length === 0) {
            set.status = StatusCode.NOT_FOUND
            return {
                status: "error",
                message: `Database '${dbName}' does not exist on the VPS`
            }
        }
        
        const backupResult = await sqlHelper.backupDatabase(dbName, userName, password)
        
        // Save backup record to database
        await db.insert(backups).values({
            dbId: dbExists[0].id.toString(),
            fileName: backupResult.backupFileName,
            vpsId: parseInt(vpsId),
            userId: userId,
            dbType: "mysql"
        });
        
        set.status = StatusCode.OK
        return {
            status: "success",
            message: backupResult.message,
            backupPath: backupResult.backupPath,
            fileName: backupResult.backupFileName
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
}
export default backupMySQL