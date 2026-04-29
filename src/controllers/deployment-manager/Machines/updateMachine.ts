import { Context } from "elysia";
import { StatusCode } from "../../../types/types";
import { vpsMachines } from "../../../db/schema";
import { eq } from "drizzle-orm";
import { db } from "../../../db/client";
import encryptVpsPassword from "../../../crypto/encryptVpsPassword";

const updateMachine = async ({ set, body, params, userId }: Context | any) => {
    const vps_Id = params.id;
    const req = body as {
        newVpsPassword?: string,
        expiryDate?: string
    }
    if (!vps_Id) {
        set.status = StatusCode.FORBIDDEN;
        return {
            status: "error",
            message: "Missing machine ID"
        }
    }
    if (!req.newVpsPassword && !req.expiryDate) {
        set.status = StatusCode.FORBIDDEN;
        return {
            status: "error",
            message: "Provide at least one field to update (newVpsPassword or expiryDate)"
        }
    }

    const machineExists = await db.select().from(vpsMachines).where(eq(vpsMachines.id, parseInt(vps_Id)));
    if (machineExists.length === 0) {
        set.status = StatusCode.NOT_FOUND;
        return {
            status: "error",
            message: "Machine not found"
        }
    }
    if(machineExists[0].ownerId!==userId){
        set.status=StatusCode.FORBIDDEN
        return{
            status:"error",
            message:"Invalid Request"
        }
    }
    // Prepare dynamic update object
    const updateData: any = {};

    if (req.newVpsPassword) {
        updateData.vps_password = encryptVpsPassword(req.newVpsPassword);
    }

    if (req.expiryDate) {
        updateData.expiryDate = new Date(req.expiryDate);
    }

    try {
        // Pass the dynamic object to .set()
        const updatedMachine = await db.update(vpsMachines)
            .set(updateData)
            .where(eq(vpsMachines.id, parseInt(vps_Id)));

        set.status = StatusCode.OK;
        return {
            status: "success",
            data: updatedMachine
        }
    } catch (error) {
        set.status = StatusCode.INTERNAL_SERVER_ERROR;
        return {
            status: "error",
            message: "Failed to update machine password",
            error: (error as Error).message
        }
    }
}
export default updateMachine;