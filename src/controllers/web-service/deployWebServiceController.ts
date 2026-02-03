import { Context } from "elysia"
import { StatusCode } from "../../types/types"
import getCredentials from "../../utils/getCredentials"
import decryptVpsPassword from "../../utils/decryptPassword"
import SSHClient from "../../SSHClient/SSHClient"
import buildRepo from "../../repoActions/cloneBuildRepo"
import startWebService from "../../repoActions/startWebService"
import getRepoName from "../../repoActions/getRepoName"
import injectEnv from "../../repoActions/injectEnv"
import { getServerConfig, getHttpServerConfig } from "../../templates/nginxConfig"
import injectNginxConfig from "../../repoActions/injectNginxConfig"
import cleanDirectory from "../../repoActions/cleanDirectory"
import enableSSLDomain from "../../repoActions/enableDomain"
import getPort from "../../repoActions/getPort"
import saveActivity from "../../utils/saveActivity"
import checkDomainValidity from "../../utils/checkDomainValidity"
import cloneRepo from "../../repoActions/cloneRepo"
import installDependencies from "../../repoActions/installDepedencies"
import socketManager from "../../ws/socketManager"
import { saveLog } from "../../repoActions/saveLog"
const deployWebServiceController = async ({ body, set }: Context) => {
    var ssh: SSHClient | null = null;

    const safeSaveLog = async (deploymentId: string, logChunk: string, sshClient: SSHClient | null) => {
        if (!sshClient) return;
        try {
            await saveLog(deploymentId, logChunk, sshClient);
        } catch (error) {
            console.error("Failed to save log:", error instanceof Error ? error.message : String(error));
            // Don't throw, just log the error and continue
        }
    };

    try {
        const { vpsId, repoUrl, deploymentId, packageInstallerCommand, buildCommand, serverFilePath, env, domain, framework, sourceDir } = body as { vpsId: string, repoUrl: string, deploymentId: string, packageInstallerCommand: string, buildCommand: string, serverFilePath: string, env: Record<string, string>, domain: string, webServiceType: string, framework: string, sourceDir?: string };
        if (!vpsId || !repoUrl || !deploymentId || !packageInstallerCommand || !domain || !framework) {
            set.status = StatusCode.BAD_REQUEST
            return {
                status: "error",
                message: "Missing required fields"
            }
        }
        const isDomainValid = await checkDomainValidity(domain);
        console.log("Domain validity check for", domain, ":", isDomainValid)
        if (!isDomainValid) {
            set.status = StatusCode.BAD_REQUEST
            return {
                status: "error",
                message: "The provided domain is not available.Domain might be already linked or invalid."
            }
        }
        const credentials = await getCredentials(vpsId)
        console.log("Credentials fetched:", credentials)
        if (!credentials) {
            set.status = StatusCode.NOT_FOUND
            return {
                status: "error",
                message: "VPS not found"
            }
        }
        const vpsIp = credentials.vps_ip;
        const vpsPassword = await decryptVpsPassword(credentials.vps_password);
        ssh = new SSHClient({
            host: vpsIp,
            port: 22,
            username: credentials.vps_username || "root",
            password: vpsPassword,
            readyTimeout: 120000,  // 120 second timeout for initial handshake
            keepaliveInterval: 30000,  // Send keep-alive every 30 seconds
            keepaliveCountMax: 5  // Disconnect after 5 missed keep-alives
        })
        try {
            await ssh.connect();
        } catch (sshError) {
            console.error("SSH Connection failed:", sshError);
            set.status = StatusCode.INTERNAL_SERVER_ERROR
            return {
                status: "error",
                message: "Failed to connect to VPS. The VPS may be unreachable.",
                error: sshError instanceof Error ? sshError.message : String(sshError)
            }
        }
        console.log("SSH Connected to VPS:", vpsIp)
        await socketManager.emitLog(deploymentId, "Installing dependencies on VPS for running the current project.This is a long process and may take about a minute or even more when deploying a new framework.\n");
        //Remove the old key for that IP and reconnect. ->
        await ssh.exec(`ssh-keygen -R ${vpsIp} -f ~/.ssh/known_hosts >/dev/null 2>&1 || true`);
        const isDependenciesInstalled = await installDependencies(ssh, framework);
        console.log("Dependencies installed for framework", framework, ":", isDependenciesInstalled);
        if (!isDependenciesInstalled) {
            await saveActivity(parseInt(credentials.ownerId), deploymentId, vpsIp, domain, "FAILED", repoUrl, "Failed to install dependencies on VPS.", framework, buildCommand, packageInstallerCommand, serverFilePath, sourceDir)
            set.status = StatusCode.INTERNAL_SERVER_ERROR
            return {
                status: "error",
                message: "Failed to install dependencies on VPS."
            }
        }

        let dirName = getRepoName(repoUrl);
        if (sourceDir && sourceDir.trim() != "") {
            dirName = `${dirName}/${sourceDir}`;
        }
        console.log("Starting to clone the repository:", repoUrl + " into " + dirName);
        const isRepoCloned = await cloneRepo(ssh, repoUrl, deploymentId);
        if (!isRepoCloned) {
            await saveActivity(parseInt(credentials.ownerId), deploymentId, vpsIp, domain, "FAILED", repoUrl, "Failed to clone the repository.", framework, buildCommand, packageInstallerCommand, serverFilePath, sourceDir)
            await cleanDirectory(ssh, getRepoName(repoUrl))
            set.status = StatusCode.BAD_REQUEST
            return {
                status: "error",
                message: "Failed to clone repository. Please check the repository URL."
            }
        }
        console.log("ENV variables to inject", env);
        if (env && Object.keys(env).length > 0) {
            console.log("Injecting environment variables into the repository at", dirName);
            const isEnvInjected = await injectEnv(ssh, env, dirName, deploymentId, framework)
            if (!isEnvInjected) {
                await saveActivity(parseInt(credentials.ownerId), deploymentId, vpsIp, domain, "FAILED", repoUrl, "Failed to inject environment variables.", framework, buildCommand, packageInstallerCommand, serverFilePath, sourceDir)
                await cleanDirectory(ssh, getRepoName(repoUrl))
                set.status = StatusCode.BAD_REQUEST
                return {
                    status: "error",
                    message: "Failed to inject environment variables. Please check the provided environment variables."
                }
            }
        }
        console.log("Starting to build the repository with build command:", buildCommand + " cloned at " + dirName);
        //docker build logic
        if (framework.toLowerCase() === "docker") {
            if (!env["PORT"] || !env["CONTAINER_PORT"]) {
                set.status = StatusCode.BAD_REQUEST
                return {
                    status: "error",
                    message: "PORT and CONTAINER_PORT must be specified in environment variables for Docker deployments."
                }
            }
            console.log("Framework is Docker. Starting Docker build process.");
            const dockerRunCommands = [
                `cd ${dirName} && docker build -t ${domain.replace(/\./g, '_')}_image .`,
                `docker run -d -p ${env["PORT"]}:${env["CONTAINER_PORT"]} --env-file ${dirName}/.env --name ${domain.replace(/\./g, '_')}_container ${domain.replace(/\./g, '_')}_image`
            ];
            console.log("Executing Docker build commands on VPS:", dockerRunCommands);
            await safeSaveLog(deploymentId, `Deploying latest commit with Docker commands:\n${dockerRunCommands.join('\n')}\n`, ssh);
            const isDockerDeployed = await ssh.runSequential(dockerRunCommands, async (logChunk) => {
                await safeSaveLog(deploymentId, logChunk, ssh);
            });
            if (!isDockerDeployed) {
                await saveActivity(parseInt(credentials.ownerId), deploymentId, vpsIp, domain, "FAILED", repoUrl, "Failed to build Docker container.", framework, buildCommand, packageInstallerCommand, serverFilePath, sourceDir)
                await cleanDirectory(ssh, getRepoName(repoUrl))
                set.status = StatusCode.BAD_REQUEST
                return {
                    status: "error",
                    message: "Failed to build Docker container. Please check the Dockerfile and build process."
                }
            }
            console.log("Docker container built and running successfully for domain:", domain);
            const port = getPort(env);

            console.log(`Application is running on port ${port}`);
            const nginxConfig = getServerConfig(domain, port);
            const isNginxConfigInjected = await injectNginxConfig(ssh, nginxConfig, domain, deploymentId);
            if (!isNginxConfigInjected) {
                await saveActivity(parseInt(credentials.ownerId), deploymentId, vpsIp, domain, "FAILED", repoUrl, "Failed to inject Nginx configuration.", framework, buildCommand, packageInstallerCommand, serverFilePath, sourceDir)
                await cleanDirectory(ssh, getRepoName(repoUrl))
                await cleanDirectory(ssh, `/etc/nginx/sites-available/${domain}`)
                await cleanDirectory(ssh, `/etc/nginx/sites-enabled/${domain}`)
                set.status = StatusCode.INTERNAL_SERVER_ERROR
                return {
                    status: "error",
                    message: "Failed to inject Nginx configuration."
                }
            }
            const isDomainEnabled = await enableSSLDomain(ssh, domain, deploymentId);
            if (!isDomainEnabled) {
                await saveActivity(parseInt(credentials.ownerId), deploymentId, vpsIp, domain, "FAILED", repoUrl, "Failed to enable domain in Nginx.", framework, buildCommand, packageInstallerCommand, serverFilePath, sourceDir)
                await cleanDirectory(ssh, getRepoName(repoUrl))
                await cleanDirectory(ssh, `/etc/nginx/sites-available/${domain}`)
                await cleanDirectory(ssh, `/etc/nginx/sites-enabled/${domain}`)
                set.status = StatusCode.FORBIDDEN
                return {
                    status: "error",
                    message: "Failed to enable domain in Nginx."
                }
            }
            await saveActivity(parseInt(credentials.ownerId), deploymentId, vpsIp, domain, "SUCCESS", repoUrl, "Web service deployed successfully.", framework, buildCommand, packageInstallerCommand, serverFilePath, sourceDir)
            return {
                status: "success",
                message: "Deployment finished",
                dirName,
            }

        }
        const isRepoBuilt = await buildRepo(ssh, repoUrl, deploymentId, packageInstallerCommand, dirName, buildCommand);
        if (!isRepoBuilt) {
            await saveActivity(parseInt(credentials.ownerId), deploymentId, vpsIp, domain, "FAILED", repoUrl, "Failed to clone or build the repository.", framework, buildCommand, packageInstallerCommand, serverFilePath, sourceDir)
            await cleanDirectory(ssh, getRepoName(repoUrl))
            set.status = StatusCode.BAD_REQUEST
            return {
                status: "error",
                message: "Failed to build repository. Please check the build command."
            }
        }

        const isRepoRunning = await startWebService(ssh, dirName, serverFilePath, deploymentId, framework, env);
        if (!isRepoRunning) {
            await saveActivity(parseInt(credentials.ownerId), deploymentId, vpsIp, domain, "FAILED", repoUrl, "Failed to start the web service.", framework, buildCommand, packageInstallerCommand, serverFilePath, sourceDir)
            await cleanDirectory(ssh, getRepoName(repoUrl))
            await ssh.exec(`pm2 delete ${dirName}`)
            set.status = StatusCode.INTERNAL_SERVER_ERROR
            return {
                status: "error",
                message: "Failed to start the application. Please check the start command and application logs."
            }
        }
        const port = getPort(env);

        console.log(`Application is running on port ${port}`);
        // Use HTTP-only config for Django, Flask, FastAPI, Spring Boot, Go, Rust, .NET (no WebSocket support)
        const useHttpOnly = ["django", "flask", "fastapi", "spring-boot", "go", "rust", "dotnet", ".net", "aspnet"].includes(framework.toLowerCase());
        const nginxConfig = useHttpOnly ? getHttpServerConfig(domain, port) : getServerConfig(domain, port);
        const isNginxConfigInjected = await injectNginxConfig(ssh, nginxConfig, domain, deploymentId);
        if (!isNginxConfigInjected) {
            await saveActivity(parseInt(credentials.ownerId), deploymentId, vpsIp, domain, "FAILED", repoUrl, "Failed to inject Nginx configuration.", framework, buildCommand, packageInstallerCommand, serverFilePath, sourceDir)
            await cleanDirectory(ssh, getRepoName(repoUrl))
            await cleanDirectory(ssh, `/etc/nginx/sites-available/${domain}`)
            await cleanDirectory(ssh, `/etc/nginx/sites-enabled/${domain}`)
            await ssh.exec(`pm2 delete ${dirName}`)
            set.status = StatusCode.INTERNAL_SERVER_ERROR
            return {
                status: "error",
                message: "Failed to inject Nginx configuration."
            }
        }
        const isDomainEnabled = await enableSSLDomain(ssh, domain, deploymentId);
        if (!isDomainEnabled) {
            await saveActivity(parseInt(credentials.ownerId), deploymentId, vpsIp, domain, "FAILED", repoUrl, "Failed to enable domain in Nginx.", framework, buildCommand, packageInstallerCommand, serverFilePath, sourceDir)
            await cleanDirectory(ssh, getRepoName(repoUrl))
            await cleanDirectory(ssh, `/etc/nginx/sites-available/${domain}`)
            await cleanDirectory(ssh, `/etc/nginx/sites-enabled/${domain}`)
            await ssh.exec(`pm2 delete ${dirName}`)
            set.status = StatusCode.FORBIDDEN
            return {
                status: "error",
                message: "Failed to enable domain in Nginx."
            }
        }
        await saveActivity(parseInt(credentials.ownerId), deploymentId, vpsIp, domain, "SUCCESS", repoUrl, "Web service deployed successfully.", framework, buildCommand, packageInstallerCommand, serverFilePath, sourceDir)
        return {
            status: "success",
            message: "Deployment finished",
            dirName,
        }
    } catch (error) {
        console.log("Error in deployController:", error)
        set.status = StatusCode.INTERNAL_SERVER_ERROR
        return {
            status: "error",
            message: "Internal Server Error"
        }
    } finally {
        if (ssh) {
            try {
                // Wait a bit for any pending saveLog operations to complete
                await new Promise(resolve => setTimeout(resolve, 1000));
                console.log("[Deploy] Closing SSH connection...");
                ssh.close();
            } catch (error) {
                console.error("[Deploy] Error closing SSH connection:", error instanceof Error ? error.message : String(error));
            }
        }
    }

}
export default deployWebServiceController