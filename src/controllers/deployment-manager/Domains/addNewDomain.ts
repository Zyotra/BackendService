import { Context } from "elysia";
import { StatusCode } from "../../../types/types";
import { userDomains } from "../../../db/schema";
import { db } from "../../../db/client";
import { eq } from "drizzle-orm";

const addNewDomain = async ({ body, set, userId }: Context | any) => {
    const req = body as {
        domainAddress: string,
        vpsIp: string
    };
    if (!req.domainAddress || !req.vpsIp) {
        set.status = 400;
        return {
            status: "error",
            message: "Missing required fields"
        }
    }
    try {
        const isDomainExists = await db.select({id:userDomains.id}).from(userDomains).where(eq(userDomains.domain_address, (req.domainAddress)));
        if (isDomainExists.length > 0) {
            set.status = StatusCode.BAD_REQUEST;
            return {
                status: "error",
                message: "Domain already exists"
            }
        }
        const newDomain = await db.insert(userDomains).values({
            domain_address: req.domainAddress,
            vps_ip: req.vpsIp,
            ownerId: userId
        }).returning();
        set.status = StatusCode.OK;
        return {
            status: "success",
            data: newDomain
        }
    } catch (error) {
        set.status = StatusCode.INTERNAL_SERVER_ERROR;
        return {
            status: "error",
            message: "Failed to add new domain",
            error: (error as Error).message
        }
    }
}
export default addNewDomain;