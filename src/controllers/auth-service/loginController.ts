import { Context } from "elysia";
import { db } from "../../db/client";
import { users } from "../../db/schema";
import { eq } from "drizzle-orm";
import { StatusCode } from "../../types/types";
import bcrypt from "bcryptjs";
import { generateAccessToken, generateRefreshToken } from "../../auth-modules/jwt/generateTokens";
const loginController = async ({ body, set, cookie }: Context) => {
    const { email, password } = body as { email: string, password: string };
    try {
        const user = await db.select().from(users).where(eq(users.email, email));
        if (user.length === 0) {
            set.status = StatusCode.FORBIDDEN;
            return { message: "Invalid email or password" };
        }
        const isPasswordValid = await bcrypt.compare(password, user[0].password); // Replace with proper password comparison
        if (!isPasswordValid) {
            set.status = StatusCode.FORBIDDEN;
            return { message: "Invalid email or password" };
        }
        const accessToken = await generateAccessToken(user[0].id.toString());
        const refreshToken = await generateRefreshToken(user[0].id.toString());
        const isProd = false;
        console.log("Is Production Environment:", isProd);
        cookie.refreshToken.set({
            value: refreshToken,
            httpOnly: true,
            secure: isProd,            // must be true on production
            sameSite: isProd ? 'none' : 'lax',
            domain: isProd ? "ramkrishna.cloud" : undefined,
            path: '/',
            maxAge: 15 * 24 * 60 * 60,
        });

        cookie.accessToken.set({
            value: accessToken,
            httpOnly: true,
            secure: isProd,
            sameSite: isProd ? 'none' : 'lax',
            domain: isProd ? "ramkrishna.cloud" : undefined,
            path: '/',
            maxAge: 15 * 60,
        });
        set.status = StatusCode.OK;
        return { message: "Login successful", userId: user[0].id, accessToken };
    } catch (error) {
        set.status = StatusCode.INTERNAL_SERVER_ERROR;
        console.error("Login Error:", error);
        return { message: "An error occurred during login" };
    }
}
export default loginController;