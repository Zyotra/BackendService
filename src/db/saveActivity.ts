import { db } from "./client";
import { activityLogs, deployments } from "./schema";
import { DeploymentStatus } from "../types/types";
import pool from "./pool";
const saveActivity = async (userId: number,deploymentId:string,vpsIp:string,domain:string,status:DeploymentStatus,repoUrl:string,log: string,framework:string,buildCommand:string,packageInstallerCommand:string,serverFilePath:string,sourceDir?:string) => {
    try {
        console.log("Saving activity data:", log);
        //using traction to add both webservicedeployment data and activity logs
        const result=await db.transaction(async(tx)=>{
            const insertDeployment=await tx.insert(deployments).values({
                ownerId: userId,
                deploymentId: deploymentId.toString(),
                logs: log,
                repoUrl:repoUrl,
                vpsIp: vpsIp,
                framework:framework,
                projectType:"WebService",
                domain: domain,
                buildCommand:buildCommand,
                packageInstallerCommand:packageInstallerCommand,
                serverFilePath:serverFilePath,
                subFolder:sourceDir || "",
                status:status,
            }).returning({id:deployments.id});
            const activityLog=await tx.insert(activityLogs).values({
                deploymentId: deploymentId.toString(),
                userId: userId,
                domain_address: domain,
                log: "Deployment of "+framework +" backend on Domain "+domain+" Status: "+status+" . Log Details: "+log,
            })
            return {deploymentRecord:insertDeployment[0],activityLog};
        })
        if(status=="SUCCESS"){
            console.log("Activity saved with SUCCESS status for deployment ID:", deploymentId);
            await pool.query(`UPDATE user_domains SET is_deployed = $1 WHERE domain_address = $2`, [1, domain]);
        }
        return true;
    } catch (error) {
        console.error("Error saving activity data:", error);
        return false;
    }
}
export default saveActivity;