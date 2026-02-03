import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { userDomains } from "../db/schema";

async function checkDomainValidity(domain: string): Promise<boolean | void> {
    try {
        const res = await db.select().from(userDomains).where(and(eq(userDomains.domain_address, domain), eq(userDomains.isDeployed, 0)));
        if(res.length > 0){
            return true;
        }else{
            return false;
        }
    } catch (error) {
        console.error("Error checking domain validity:", error);
        return false;
    }
}
export default checkDomainValidity;