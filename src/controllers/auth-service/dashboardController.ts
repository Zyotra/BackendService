import { Context } from "elysia";
import { StatusCode } from "../../types/types";
import { db } from "../../db/client";
import { users } from "../../db/schema";
import { eq } from "drizzle-orm";
const dashboardController = async({ set,userId }: Context | any)=>{
    set.status = StatusCode.OK;
    console.log("User ID:", userId);
    const user = await db.select().from(users).where(eq(users.id, userId));
    if (user.length === 0) {
        set.status = StatusCode.NOT_FOUND;
        return { message: "User not found" };
    }
    console.log("User data:", user[0]);
    set.status = StatusCode.OK;
    return { message: "Welcome to the dashboard",
        userEmail: user[0].email,
        userName: user[0].name
     };
}

export default dashboardController;