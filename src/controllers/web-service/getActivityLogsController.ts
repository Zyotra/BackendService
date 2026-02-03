import { Context } from "elysia"
import { db } from "../../db/client";
import { activityLogs } from "../../db/schema";
import { desc, eq } from "drizzle-orm";
import { StatusCode } from "../../types/types";

const getActivityLogsController = async({userId,set}: Context | any) => {
    try {
        const logs=await db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)).where(eq(activityLogs.userId,userId)).limit(10);
        console.log("Fetched activity logs for user", userId, ":", logs);
        set.status=StatusCode.OK;
        return {
            status:"success",
            data:logs
        }
    } catch (error) {
        console.error("Error fetching activity logs for user", userId, ":", error);
        set.status=StatusCode.INTERNAL_SERVER_ERROR;
        return {
            status:"error",
            message:"Failed to fetch activity logs"
        }
    }
}
export default getActivityLogsController;