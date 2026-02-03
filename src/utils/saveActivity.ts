import { eq } from "drizzle-orm/sql/expressions/conditions";
import { db } from "../db/client";
import { activityLogs,deployments, userDomains} from "../db/schema";
import { DeploymentStatus } from "../types/types";
const saveActivity = async (userId: number,deploymentId:string,vpsIp:string,domain:string,status:DeploymentStatus,repoUrl:string,log: string,framework:string,buildCommand:string,packageInstallerCommand:string,serverFilePath:string,sourceDir?:string,projectType?:string) => {
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
                projectType:projectType || "WebService",
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
            await db.update(userDomains).set({isDeployed:1}).where(eq(userDomains.domain_address, domain));
        }
        return true;
    } catch (error) {
        console.error("Error saving activity data:", error);
        return false;
    }
}
export default saveActivity;