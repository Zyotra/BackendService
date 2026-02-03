import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { vpsMachines } from "../db/schema";
const verifyMachine=async (machineId:string,userId:string):Promise<boolean>=>{
    const res=await db.select().from(vpsMachines).where(and(eq(vpsMachines.id, parseInt(machineId)), eq(vpsMachines.ownerId, parseInt(userId))));
    if(res.length===0){
        return false;
    }
    return true; 
}
export default verifyMachine;