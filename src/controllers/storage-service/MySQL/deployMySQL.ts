import { Context } from "elysia";
import { StatusCode } from "../../../types/types";
import MySQLHelper from "../../../HelperClasses/mySQLHelper";
import SSHClient from "../../../SSHClient/SSHClient";
import decryptVpsPassword from "../../../utils/decryptPassword";
import { db } from "../../../db/client";
import { deployed_db, vpsMachines } from "../../../db/schema";
import { and, eq } from "drizzle-orm";

export const verifyMachine=async (machineId:string,userId:string,machineIp:string)=>{
    const res=await db.select().from(vpsMachines).where(and(eq(vpsMachines.id,parseInt(machineId)),eq(vpsMachines.ownerId,parseInt(userId))));
    if(res.length<=0){
        return {
            status:false,
            machine:null
        };
    }
    const machine=res[0];
    if(machine.vps_ip!==machineIp){
        return {
            status:false,
            machine:null
        }
    }
    return {
        status:true,
        machine
    }
}

const deployMySQL=async({body,set,userId}:Context | any)=>{
    const req = body as { vpsId: string,vpsIp:string, dbName: string,userName:string, password: string,rootPassword:string };
    const {vpsId,vpsIp,dbName,userName,password,rootPassword} = req;
    if(!userName || !password || !dbName || !vpsIp || !vpsId || !rootPassword){
        set.status = StatusCode.BAD_REQUEST;
        return {
            message: "Invalid request body"
        }
    }
    const isMachineVerified=await verifyMachine(vpsId,userId,vpsIp);
    if(!isMachineVerified.status || !isMachineVerified){
        set.status = StatusCode.FORBIDDEN;
        return {
            message: "Unauthorized access for the machine"
        }
    }
    var ssh:SSHClient | null =null
    var sqlHelper:MySQLHelper | null =null
    const {machine}=isMachineVerified;
    if(!machine){
        set.status=StatusCode.FORBIDDEN
        return{
            message:"Machine verification failed"
        }
    }
    try {
        const hashedPassword=await decryptVpsPassword(machine.vps_password)
        ssh=new SSHClient({
            username:"root",
            host:vpsIp,
            password:hashedPassword
        })
        await ssh.connect()
        sqlHelper=new MySQLHelper(ssh)
        const result=await sqlHelper.setupMySQL(rootPassword,userName,password,dbName)
        await db.insert(deployed_db).values({
            dbName:dbName,
            host:vpsIp,
            username:userName,
            password:password,
            dbType:"mysql",
            vpsId:parseInt(vpsId),
            userId:userId,
            status:"running"
        });
        return{
            message:"success",
            data:result
        }

    } catch (error) {
        console.log("Error while deploying MYSQL database")
        if(sqlHelper && ssh){
            try {
                await sqlHelper.dropDatabase(userName,password,dbName)
            } catch (dropError) {
                console.log("Error while dropping database:", dropError)
            }
        }
        set.status=StatusCode.INTERNAL_SERVER_ERROR
        return{
            message:error
        }
    }finally{
        if(ssh){
            await ssh.close()
        }
    }
}
export default deployMySQL