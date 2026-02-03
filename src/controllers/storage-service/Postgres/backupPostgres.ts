import { Context } from "elysia";
import SSHClient from "../../../SSHClient/SSHClient";
import { PostgresSSHHelper } from "../../../HelperClasses/PostgresHelper";
import verifyMachine from "../../../utils/verifyMachine";
import decryptVpsPassword from "../../../utils/decryptPassword";
import { StatusCode } from "../../../types/types";

const backupPostgres = async ({ body, set, userId }: Context | any) => {
    const req=body as {username:string,password:string,databaseName:string,vpsId:string,vpsIp:string};
    const {username,password,databaseName,vpsId,vpsIp}=req;
    var pgHelper:PostgresSSHHelper | null=null;
    var ssh:SSHClient|null=null
    try {
        const isMachineVerified=await verifyMachine(vpsId,userId,vpsIp)
        const {machine}=isMachineVerified;
        const hashedPassword=await decryptVpsPassword(machine.vps_password)
        ssh=new SSHClient({
            username:"root",
            host:vpsIp,
            password:hashedPassword
        })
        pgHelper=new PostgresSSHHelper(ssh)
        const backupResult = await pgHelper.backupDatabase(databaseName, username)
        set.status=StatusCode.OK
        return{
            status: "success",
            message: backupResult.message,
            backupPath: backupResult.backupPath
        }
    } catch (error) {
        set.status=StatusCode.INTERNAL_SERVER_ERROR
        return{
            status: "error",
            message: error instanceof Error ? error.message : String(error)
        }
    }finally{
        if(ssh){
            await ssh.close()
        }
    }
};
export default backupPostgres
