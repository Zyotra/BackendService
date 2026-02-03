import pool from "../db/pool";
const verifyMachine=async (machineId:string,userId:string):Promise<boolean>=>{
    const res=await pool.query('SELECT * FROM vps_machines WHERE id=$1 AND "ownerId"=$2',[machineId,userId]);
    if(res.rowCount===0){
        return false;
    }
    return true; 
}
export default verifyMachine;