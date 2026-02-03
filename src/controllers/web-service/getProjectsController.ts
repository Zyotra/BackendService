import { Context } from "elysia"
import { db } from "../../db/client"
import { deployments } from "../../db/schema";
import { eq } from "drizzle-orm";
import { StatusCode } from "../../types/types";
const getProjectsController = async({set,userId}: Context | any)=>{
    try {
        const projects=await db.select().from(deployments).where(eq(deployments.ownerId, userId));
        set.status = StatusCode.OK
        return {
            status: "success",
            data: projects
        }
    } catch (error) {
        set.status = StatusCode.INTERNAL_SERVER_ERROR
        console.log("Error in getProjectsController:", error)
        return {
            status: "error",
            message: "An error occurred while fetching projects.",
            error
        }
    }

}
export default getProjectsController;