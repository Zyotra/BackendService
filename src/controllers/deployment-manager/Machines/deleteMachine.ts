import { Context } from "elysia";
import { StatusCode } from "../../../types/types";
import { vpsMachines } from "../../../db/schema";
import { eq } from "drizzle-orm";
import { db } from "../../../db/client";

const deleteMachine = async ({ set, params, userId }: Context | any) => {
    const vps_Id = params.id;
    if (!vps_Id) {
        set.status = StatusCode.FORBIDDEN;
        return {
            status: "error",
            message: "Missing machine ID"
        }
    }
    try {
        const machineExists = await db.select({ownerId:vpsMachines.ownerId}).from(vpsMachines).where(eq(vpsMachines.id, parseInt(vps_Id)));
        if (machineExists.length === 0) {
            set.status = StatusCode.NOT_FOUND;
            return {
                status: "error",
                message: "Machine not found"
            }
        }

        if (machineExists[0].ownerId != userId) {
            set.status = StatusCode.UNAUTHORIZED;
            return {
                status: "error",
                message: "Unauthorized to delete this machine"
            }
        }
        await db.delete(vpsMachines).where(eq(vpsMachines.id, parseInt(vps_Id)));
        set.status = StatusCode.OK;
        return {
            status: "success",
            message: "Machine deleted successfully"
        }
    } catch (error) {
        set.status = StatusCode.INTERNAL_SERVER_ERROR;
        return {
            status: "error",
            message: "Failed to delete machine",
            error: (error as Error).message
        }
    }
}
export default deleteMachine;