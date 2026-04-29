import { Context } from "elysia";
import { StatusCode } from "../../../types/types";
import { db } from "../../../db/client";
import { userDomains } from "../../../db/schema";
import { eq } from "drizzle-orm";

const getDomains = async ({ userId, set }: Context | any) => {
    if (!userId) {
        set.status = StatusCode.FORBIDDEN
        return {
            status: "error",
            message: "Unauthorized. No user is associated with the request"
        }
    }
    try {
        const domains = await db.select({
            id:userDomains.id,
            domain_address:userDomains.domain_address,
            vps_ip:userDomains.vps_ip,
            added_at:userDomains.added_at,
            isDeployed:userDomains.isDeployed
        }).from(userDomains).where(eq(userDomains.ownerId, userId))
        set.status = StatusCode.OK;
        return {
            status: "success",
            data: domains
        };
    } catch (error) {
        set.status = StatusCode.INTERNAL_SERVER_ERROR;
        return {
            status: "error",
            message: "Failed to retrieve domains",
            error: (error as Error).message
        }
    }

}
export default getDomains;