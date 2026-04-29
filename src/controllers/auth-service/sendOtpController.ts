import { Context, status } from "elysia";
import sendEmail from "../../auth-modules/mail/sendEmail";
import { StatusCode } from "../../types/types";
import { db } from "../../db/client";
import { users } from "../../db/schema";
import { eq } from "drizzle-orm";

const sendOtpController = async ({ body, set }: Context) => {
    const req = body as { email: string };
    set.status = StatusCode.BAD_REQUEST;
    if (!req.email) {
        return { message: "Email is required" };
    }
    const userExists = await db
        .select({
            id:users.id
        }).from(users).where(eq(users.email, req.email)).limit(1);
    if (userExists.length > 0) {
        set.status = StatusCode.BAD_REQUEST;
        return { message: "Email is already registered" };
    }
    await sendEmail({ to: req.email });
    set.status = StatusCode.OK;
    return { message: "OTP sent successfully" };
}
export default sendOtpController;