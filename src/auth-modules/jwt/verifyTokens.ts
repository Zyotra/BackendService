import jwt from "jsonwebtoken";
import { db } from "../db/client";
import { login_Sessions } from "../db/schema";
import { eq } from "drizzle-orm";

export const verifyAccessToken = async (token: string)=> {
    try {
        const user = await jwt.verify(token, process.env.ACCESS_TOKEN_SECRET as string) as {userId: string};
        console.log("Decoded token payload:", user);
        return{ userId: user.userId };
    } catch (error) {
        return false;
    }
}
export const verifyRefreshToken=async (token:string):Promise<boolean | any>=>{
    try {
        const user=jwt.verify(token,process.env.REFRESH_TOKEN_SECRET as string) as {userId:string};
        console.log("User decoded from refresh token:", user);
        const tokenFound=await db.select().from(login_Sessions).where(eq(login_Sessions.userId,Number(user?.userId)));
        if(tokenFound.length===0) return false;
        if(tokenFound[0].expiresAt < new Date()) return false;
        if(tokenFound[0].refreshToken !== token) return false;
        if(!tokenFound[0]) return false;
        return {
            status: true,
            userId: user.userId
        };
    } catch (error) {
        return false;
    }
}