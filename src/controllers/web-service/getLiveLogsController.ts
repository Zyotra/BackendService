import { Context } from "elysia";
import { StatusCode } from "../../types/types";
import { db } from "../../db/client";
import { deployments, vpsMachines } from "../../db/schema";
import { and, eq } from "drizzle-orm";
import decryptVpsPassword from "../../utils/decryptPassword";
import SSHClient from "../../SSHClient/SSHClient";
import getRepoName from "../../repoActions/getRepoName";

const getLiveLogsController = async ({ params, set, userId, body }: Context | any) => {
    const deploymentId = params.id;
    try {
        const project = await db.select({
            vpsIp: deployments.vpsIp,
            repoUrl: deployments.repoUrl,
            subFolder: deployments.subFolder
        }).from(deployments).where(
            and(eq(deployments.deploymentId, deploymentId), eq(deployments.ownerId, userId))
        );

        if (!project || project.length === 0) {
            set.status = StatusCode.NOT_FOUND;
            return { message: "Project not found" };
        }

        const vpsMachine = await db.select({
            vps_ip: vpsMachines.vps_ip,
            vps_password: vpsMachines.vps_password
        }).from(vpsMachines).where(and(eq(vpsMachines.vps_ip, project[0].vpsIp), eq(vpsMachines.ownerId, userId)))

        if (!vpsMachine || vpsMachine.length === 0) {
            set.status = StatusCode.NOT_FOUND;
            return { message: "VPS Machine not found" };
        }

        const hashedPassword = await decryptVpsPassword(vpsMachine[0].vps_password);
        const ssh = new SSHClient({
            username: "root",
            host: vpsMachine[0].vps_ip,
            password: hashedPassword,
        });

        await ssh.connect();

        let repoName = getRepoName(project[0].repoUrl);
        if (project[0].subFolder && project[0].subFolder.trim() !== "") {
            repoName = `${repoName}/${project[0].subFolder}`;
        }

        // Set headers for SSE (merge with existing CORS headers)
        set.headers = {
            ...set.headers,
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        };

        const stream = new ReadableStream({
            async start(controller) {
                let isClosed = false;

                const safeEnqueue = (message: string) => {
                    if (!isClosed) {
                        try {
                            controller.enqueue(message);
                        } catch (error) {
                            if (error instanceof Error && error.message.includes('closed')) {
                                isClosed = true;
                            }
                        }
                    }
                };

                const safeClose = () => {
                    if (!isClosed) {
                        try {
                            controller.close();
                            isClosed = true;
                        } catch (error) {
                            // Controller already closed, ignore
                            isClosed = true;
                        }
                    }
                };

                try {
                    // Send initial connection message
                    safeEnqueue(`data: ${JSON.stringify({ type: 'connected', deploymentId })}\n\n`);

                    // Stream PM2 logs using tail -f like behavior
                    const command = `pm2 logs ${repoName} --lines 100 --raw`;

                    await ssh.execStream(command, {
                        onStdout: (data: string) => {
                            const logEntry = {
                                type: 'log',
                                timestamp: new Date().toISOString(),
                                data: data.toString(),
                                deploymentId
                            };
                            safeEnqueue(`data: ${JSON.stringify(logEntry)}\n\n`);
                        },
                        onStderr: (data: string) => {
                            const errorEntry = {
                                type: 'error',
                                timestamp: new Date().toISOString(),
                                data: data.toString(),
                                deploymentId
                            };
                            safeEnqueue(`data: ${JSON.stringify(errorEntry)}\n\n`);
                        },
                        onClose: () => {
                            if (!isClosed) {
                                safeEnqueue(`data: ${JSON.stringify({ type: 'closed', deploymentId })}\n\n`);
                            }
                            safeClose();
                            ssh.close();
                        }
                    });

                } catch (error) {
                    if (!isClosed) {
                        const errorEntry = {
                            type: 'error',
                            message: 'Stream error',
                            error: error instanceof Error ? error.message : 'Unknown error'
                        };
                        safeEnqueue(`data: ${JSON.stringify(errorEntry)}\n\n`);
                    }
                    safeClose();
                    ssh.close();
                }
            },
            cancel() {
                ssh.close();
            }
        });

        return stream;

    } catch (error) {
        console.log("Error in getLiveLogController", error);
        set.status = StatusCode.INTERNAL_SERVER_ERROR;
        return { message: "Internal Server Error" };
    }
};

export default getLiveLogsController;