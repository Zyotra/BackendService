import SSHClient from "../SSHClient/SSHClient"
import socketManager from "../ws/socketManager";
import { saveLog } from "./saveLog";

const copyAssets=async(ssh:SSHClient,dirName:string,outDir:string,deploymentId:string)=>{
    try {
        let commands;
        if (outDir && outDir.trim() !== "") {
            // Copy from build output directory (e.g., dist, build)
            commands=[
                `mkdir -p /var/www/${dirName}`,
                `cp -r ${dirName}/${outDir}/* /var/www/${dirName}/`,
                `rm -rf ${dirName}/${outDir}`
            ]
        } else {
            // Copy source files directly (plain HTML)
            commands=[
                `mkdir -p /var/www/${dirName}`,
                `cp -r ${dirName}/* /var/www/${dirName}/`
            ]
        }
        await saveLog(deploymentId,`${commands.join('\n')}\n`, ssh)
        await socketManager.emitLog(deploymentId,`${commands.join('\n')}\n`)
        await ssh.runSequential(commands,async logChunk=>{
            console.log(logChunk);
            await saveLog(deploymentId,logChunk, ssh)
            await socketManager.emitLog(deploymentId,logChunk);
        })
        return true
    } catch (error) {
        console.error("Error copying assets:", error);
        return false
    }
}
export default copyAssets;