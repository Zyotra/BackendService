import { Context } from "elysia";
import SSHClient from "../../../SSHClient/SSHClient";
import { PostgresSSHHelper } from "../../../HelperClasses/PostgresHelper";
import { verifyMachine } from "../MySQL/deployMySQL";
import decryptVpsPassword from "../../../utils/decryptPassword";
import { StatusCode } from "../../../types/types";
import { backups, deployed_db } from "@/db/schema";
import { db } from "@/db/client";
import { and, eq } from "drizzle-orm";

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
        //check if database exists
        const dbExists=await db.select().from(deployed_db).where(and(eq(deployed_db.dbName, dbName),eq(deployed_db.vpsId,parseInt(vpsId))));
        if (!dbExists || dbExists.length===0) {
            set.status = StatusCode.NOT_FOUND
            return {
                status: "error",
                message: `Database '${dbName}' does not exist on the VPS`
            }
        }
        const backupResult = await pgHelper.backupDatabase(dbName, userName);
        
        // Read backup file from remote VPS via SSH
        const readResult = await ssh.exec(`cat ${backupResult.backupPath}`);
        if (readResult.exitCode !== 0) {
            throw new Error(`Failed to read backup file: ${readResult.output}`);
        }
        
        // Upload to S3
        const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
        const s3Client = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
        await s3Client.send(new PutObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME!,
            Key: backupResult.backupFileName,
            Body: readResult.output,
            ContentType: "application/octet-stream"
        }));
        
        set.status = StatusCode.OK
        await db.insert(backups).values({
            dbId: dbExists[0].id.toString(),
            fileName: backupResult.backupFileName,
            vpsId: parseInt(vpsId),
            userId: userId,
            dbType: "postgres"
        });
        return {
            status: "success",
            message: backupResult.message,
            backupPath: backupResult.backupPath,
            fileName: backupResult.backupFileName
        }
    } catch (error) {
        console.error("Backup postgres error:", error);
        set.status = StatusCode.INTERNAL_SERVER_ERROR
        return {
            status: "error",
            message: error instanceof Error ? error.message : String(error)
        }
    } finally {
        try {
            if (ssh) {
                await ssh.close()
            }
        } catch (closeError) {
            console.error("Error closing SSH connection:", closeError);
        }
    }
};
export default backupPostgres
