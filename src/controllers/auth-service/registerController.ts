import { Context } from "elysia";
import { db } from "../../db/client";
import { otps, users } from "../../db/schema";
import hashPassword from "../../auth-modules/hashPassword";
import { StatusCode } from "../../types/types";
import { and, eq } from "drizzle-orm";

const registerController = async ({ body, set }: Context) => {
    const { email, password, name, otp } = body as { email: string; password: string; name: string; otp: string };
    if (!email || !password || !name || !otp) {
        set.status = StatusCode.BAD_REQUEST;
        return { message: "Email, password, name, and OTP are required" };
    }
    try {
        const result = await db.transaction(async (tx) => {
            const [otpRow] = await tx
                .select({
                    id:otps.id,
                    expiresAt:otps.expiresAt
                })
                .from(otps)
                .where(and(eq(otps.email, email), eq(otps.otp, otp)))
                .limit(1);

            if (!otpRow) return { success: false, message: "Invalid OTP" };
            if (new Date(otpRow.expiresAt) <= new Date()) return { success: false, message: "OTP expired" };

            const passwordHash = await hashPassword(password);
            await tx.insert(users).values({ email, password: passwordHash, name });
            await tx.delete(otps).where(eq(otps.id, otpRow.id));

            return { success: true };
        });

        if (!result.success) {
            set.status = StatusCode.BAD_REQUEST;
            return { message: result.message };
        }

        set.status = StatusCode.OK;
        return { message: "User registered successfully" };
    } catch (error) {
        set.status = StatusCode.INTERNAL_SERVER_ERROR;
        return { message: "Error registering user", error };
    }
};

export default registerController;