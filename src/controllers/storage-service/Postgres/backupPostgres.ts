import { Context } from "elysia";

import SSHClient from "../../../SSHClient/SSHClient";
import { getS3Client } from "../../../bucket/s3";
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
        const dbExists = await db.select().from(deployed_db).where(and(eq(deployed_db.dbName, dbName), eq(deployed_db.vpsId, parseInt(vpsId))));
        if (!dbExists || dbExists.length === 0) {
            set.status = StatusCode.NOT_FOUND
            return {
                status: "error",
                message: `Database '${dbName}' does not exist on the VPS`
            }
        }
        const backupResult = await pgHelper.backupDatabase(dbName, userName);



        // Create a stream from the remote file
        const stream = await ssh.createExecStream(`cat ${backupResult.backupPath}`);

        // Upload to S3 using streaming (prevents memory issues)
        const { Upload } = await import("@aws-sdk/lib-storage");

        const upload = new Upload({
            client: getS3Client(),
            params: {
                Bucket: process.env.S3_BUCKET_NAME!,
                Key: backupResult.backupFileName,
                Body: stream,
                ContentType: "application/octet-stream"
            },
        });

        await upload.done();

        // Clean up the remote backup file after successful upload
        await ssh.exec(`rm ${backupResult.backupPath}`).catch(err => {
            console.error("Failed to delete remote backup file:", err);
        });

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
