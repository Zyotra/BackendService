import { and, eq } from "drizzle-orm/sql/expressions/conditions";
import { db } from "../db/client";
import { vpsMachines } from "../db/schema";

export const getMachineDetail = async (vps_ip: string, userId: string) => {
    // Query by vps_ip column, not id column
    const res= await db.select().from(vpsMachines).where(and(eq(vpsMachines.vps_ip, vps_ip), eq(vpsMachines.ownerId, parseInt(userId))));   
    
    if (res.length === 0) {
        return null;
    }
    return res[0];
}

export default getMachineDetail;