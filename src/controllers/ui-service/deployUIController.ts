import { Context } from "elysia"
import { StatusCode } from "../../types/types"
import getCredentials from "../../utils/getCredentials"
import decryptVpsPassword from "../../utils/decryptPassword"
import SSHClient from "../../SSHClient/SSHClient"
import buildRepo from "../../repoActions/cloneBuildRepo"
import getRepoName from "../../repoActions/getRepoName"
import injectEnv from "../../repoActions/injectEnv"
import { getServerConfig, getServerConfigFrontend } from "../../templates/nginxConfig"
import injectNginxConfig from "../../repoActions/injectNginxConfig"
import cleanDirectory from "../../repoActions/cleanDirectory"
import enableSSLDomain from "../../repoActions/enableDomain"
import saveActivity from "../../utils/saveActivity"
import checkDomainValidity from "../../utils/checkDomainValidity"
import cloneRepo from "../../repoActions/cloneRepo"
import copyAssets from "../../repoActions/copyAssets"
import installDependencies from "../../repoActions/installDepedencies"
import socketManager from "../../ws/socketManager"
import { get } from "http"

const frontendProjectTypes = ["react", "vue", "angular", "svelte", "nextjs", "nuxtjs", "gatsby", "plainhtml", "flask", "other"]
const deployUIController = async ({ body, set }: Context) => {
    var ssh: SSHClient | null = null;
    try {
        const { vpsId, repoUrl, deploymentId, packageInstallerCommand, buildCommand, outDir, env, domain, framework,sourceDir } = body as { vpsId: string, repoUrl: string, deploymentId: string, packageInstallerCommand: string, buildCommand: string, outDir: string, env: Record<string, string>, domain: string, webServiceType: string, framework: string,sourceDir:string };
        if (!vpsId || !repoUrl || !deploymentId || !packageInstallerCommand || !domain || !framework) {
            set.status = StatusCode.BAD_REQUEST
            return {
                status: "error",
                message: "Missing vpsId or buildId"
            }
        }
        if (!frontendProjectTypes.includes(framework.toLowerCase())) {
            set.status = StatusCode.BAD_REQUEST
            return {
                status: "error",
                message: "Invalid project type for UI deployment."
            }
        }
        console.log("Starting deployment for deploymentId:", deploymentId)
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
            password: vpsPassword
        })
        await ssh.connect();
        console.log("SSH Connected to VPS:", vpsIp)
        socketManager.emitLog(deploymentId, `Installing required dependencies...\n`)
        const isDepInstalled = await installDependencies(ssh, framework);
        if (!isDepInstalled) {
            await saveActivity(parseInt(credentials.ownerId), deploymentId, vpsIp, domain, "FAILED", repoUrl, "Failed to install dependencies on the VPS.", framework, buildCommand, packageInstallerCommand, "", sourceDir, "UI")
            set.status = StatusCode.INTERNAL_SERVER_ERROR
            return {
                status: "error",
                message: "Failed to install dependencies on the VPS."
            }
        }
        let dirName = getRepoName(repoUrl);
        if(sourceDir && sourceDir.trim()!=""){
            dirName = `${dirName}/${sourceDir}`;
        }
        console.log("Starting to clone the repository:", repoUrl + " into " + dirName);
        const isRepoCloned = await cloneRepo(ssh, repoUrl, deploymentId);
        if (!isRepoCloned) {
            await saveActivity(parseInt(credentials.ownerId), deploymentId, vpsIp, domain, "FAILED", repoUrl, "Failed to clone the repository.", framework, buildCommand, packageInstallerCommand, "", sourceDir, "UI")
            await cleanDirectory(ssh, getRepoName(repoUrl))
            set.status = StatusCode.BAD_REQUEST
            return {
                status: "error",
                message: "Failed to clone repository. Please check the repository URL."
            }
        }
        console.log("Env Injection Check")
        if (env && Object.keys(env).length > 0) {
            console.log("Injecting environment variables into .env file for directory:", dirName);
            const isEnvInjected = await injectEnv(ssh, env, dirName, deploymentId)
            if (!isEnvInjected) {
                await saveActivity(parseInt(credentials.ownerId), deploymentId, vpsIp, domain, "FAILED", repoUrl, "Failed to inject environment variables.", framework, buildCommand, packageInstallerCommand, "", sourceDir, "UI")
                await cleanDirectory(ssh, getRepoName(repoUrl))
                set.status = StatusCode.BAD_REQUEST
                return {
                    status: "error",
                    message: "Failed to inject environment variables. Please check the provided environment variables."
                }
            }
        }
        await ssh.exec("sleep 1") // slight delay to ensure env file is written before build
        console.log("Starting to build the repository with build command:", buildCommand + " cloned at " + dirName);
        if (framework.toLowerCase() == "plainhtml" || framework.toLowerCase() == "htmlcssjs" || framework.toLowerCase() == "html") {
            const isRepoCopied = await copyAssets(ssh, dirName, "", deploymentId);
        if (!isRepoCopied) {
            await saveActivity(parseInt(credentials.ownerId), deploymentId, vpsIp, domain, "FAILED", repoUrl, "Failed to copy build assets to the deployment directory.", framework, buildCommand, packageInstallerCommand, "", sourceDir, "UI")
            await cleanDirectory(ssh, getRepoName(repoUrl))
            await cleanDirectory(ssh, `/var/www/${dirName}`)
            set.status = StatusCode.INTERNAL_SERVER_ERROR
            return {
                status: "error",
                message: "Failed to copy build assets to the deployment directory."
            }
        }
        } else {
            const isRepoBuilt = await buildRepo(ssh, repoUrl, deploymentId, packageInstallerCommand,dirName, buildCommand);
            if (!isRepoBuilt) {
                await saveActivity(parseInt(credentials.ownerId), deploymentId, vpsIp, domain, "FAILED", repoUrl, "Failed to build the repository. Check build command and logs.", framework, buildCommand, packageInstallerCommand, "", sourceDir, "UI")
                await cleanDirectory(ssh, getRepoName(repoUrl))
                set.status = StatusCode.BAD_REQUEST
                return {
                    status: "error",
                    message: "Failed to build repository. Please check the build command."
                }
            }
        
        const isRepoCopied = await copyAssets(ssh, dirName, outDir, deploymentId);
        if (!isRepoCopied) {
            await saveActivity(parseInt(credentials.ownerId), deploymentId, vpsIp, domain, "FAILED", repoUrl, "Failed to copy build assets to the deployment directory.", framework, buildCommand, packageInstallerCommand, "", sourceDir, "UI")
            await cleanDirectory(ssh, getRepoName(repoUrl))
            await cleanDirectory(ssh, `/var/www/${getRepoName(repoUrl)}`)
            set.status = StatusCode.INTERNAL_SERVER_ERROR
            return {
                status: "error",
                message: "Failed to copy build assets to the deployment directory."
            }
        }
    }
        const nginxConfig = getServerConfigFrontend(domain, dirName);
        const isNginxConfigInjected = await injectNginxConfig(ssh, nginxConfig, domain, deploymentId);
        if (!isNginxConfigInjected) {
            await saveActivity(parseInt(credentials.ownerId), deploymentId, vpsIp, domain, "FAILED", repoUrl, "Failed to inject Nginx configuration.", framework, buildCommand, packageInstallerCommand, "", sourceDir, "UI")
            await cleanDirectory(ssh, getRepoName(repoUrl))
            await cleanDirectory(ssh, `/var/www/${getRepoName(repoUrl)}`)
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
            await saveActivity(parseInt(credentials.ownerId), deploymentId, vpsIp, domain, "FAILED", repoUrl, "Failed to enable domain in Nginx.", framework, buildCommand, packageInstallerCommand, "", sourceDir, "UI")
            await cleanDirectory(ssh, getRepoName(repoUrl))
            await cleanDirectory(ssh, `/var/www/${getRepoName(repoUrl)}`)
            await cleanDirectory(ssh, `/etc/nginx/sites-available/${domain}`)
            await cleanDirectory(ssh, `/etc/nginx/sites-enabled/${domain}`)
            await ssh.exec(`pm2 delete ${dirName}`)
            set.status = StatusCode.FORBIDDEN
            return {
                status: "error",
                message: "Failed to enable domain in Nginx."
            }
        }
        await saveActivity(parseInt(credentials.ownerId), deploymentId, vpsIp, domain, "SUCCESS", repoUrl, "UI DEPLOYED SUCCESSFULLY", framework, buildCommand, packageInstallerCommand, "", sourceDir, "UI")
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
            console.log("[Deploy] Closing SSH connection...");
            ssh.close();
        }
    }

}
export default deployUIController