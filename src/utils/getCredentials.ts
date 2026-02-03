import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { vpsMachines } from "../db/schema";
const getCredentials = async (vpsId: string) => {
    try {
        console.log("Fetching credentials for VPS ID:", vpsId);
        const res = await db.select().from(vpsMachines).where(eq(vpsMachines.id, parseInt(vpsId)));
        if (res.length === 0) {
            return null;
        }
        return res[0];
    } catch (error) {
        console.error("Error fetching credentials:", error);
        throw new Error("Failed to fetch credentials");
    }
}
export default getCredentials;