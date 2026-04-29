import { Context } from "elysia";
import { StatusCode } from "../../../types/types";
import { db } from "../../../db/client";
import { userDomains } from "../../../db/schema";
import { eq } from "drizzle-orm";
const deleteDomain = async ({ params, set, userId }: Context | any) => {
    const domainId = params.id;
    if (!domainId) {
        set.status = StatusCode.FORBIDDEN;
        return {
            status: "error",
            message: "Missing domain ID"
        }
    }
    const domainExists = await db
        .select({
            ownerId:userDomains.ownerId,
            isDeployed:userDomains.isDeployed
        })
        .from(userDomains).where(eq(userDomains.id, parseInt(domainId)));
    if (domainExists.length === 0) {
        set.status = StatusCode.NOT_FOUND;
        return {
            status: "error",
            message: "Domain not found"
        }
    }
    console.log(domainExists[0].ownerId);
    console.log(userId);
    // Check if the domain belongs to the user
    if (domainExists[0].ownerId != userId) {
        set.status = StatusCode.UNAUTHORIZED;
        return {
            status: "error",
            message: "Unauthorized to delete this domain"
        }
    }
    if (domainExists[0].isDeployed) {
        set.status = StatusCode.FORBIDDEN;
        return {
            status: "error",
            message: "Cannot delete a deployed domain. Please undeploy it first."
        }
    }
    try {
        await db.delete(userDomains).where(eq(userDomains.id, parseInt(domainId)));
        set.status = StatusCode.OK;
        return {
            status: "success",
            message: "Domain deleted successfully"
        }
    } catch (error) {
        set.status = StatusCode.INTERNAL_SERVER_ERROR;
        return {
            status: "error",
            message: "Failed to delete domain",
            error: (error as Error).message
        }
    }
}

export default deleteDomain