import { eq } from "drizzle-orm/sql/expressions/conditions";
import { db } from "../db/client";
import { userDomains } from "../db/schema";

async function unLinkDomain(domain: string): Promise<boolean | void> {
    try {
        const res=await db.update(userDomains).set({isDeployed:0}).where(eq(userDomains.domain_address, domain));
        return true;
    } catch (error) {
        console.error("Error unlinking domain:", error);
        return false;
    }
}
export default unLinkDomain;