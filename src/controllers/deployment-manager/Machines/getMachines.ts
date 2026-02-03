import { Context } from "elysia";
import { StatusCode } from "../../../types/types";
import { db } from "../../../db/client";
import { vpsMachines } from "../../../db/schema";
import { eq } from "drizzle-orm";
const getMachines = async ({ userId, set }: Context | any) => {
    if (!userId) {
        set.status = StatusCode.NOT_FOUND;
        return {
            status: "error",
            message: "Unauthorized. No user is associated with the request"
        }
    }
    console.log("Fetching machines for user:", userId);
    const machines = await db.select().from(vpsMachines).where(eq(vpsMachines.ownerId, userId));
    set.status = StatusCode.OK;
    return {
        status: "success",
        data: machines
    };
}
export default getMachines;