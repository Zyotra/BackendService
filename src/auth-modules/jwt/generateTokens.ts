import jwt from "jsonwebtoken";
import { login_Sessions } from "../db/schema";
import { db } from "../db/client";
import { eq } from "drizzle-orm";

export const generateAccessToken=async (userId:string):Promise<string>=>{
    const accessToken=jwt.sign({userId},process.env.ACCESS_TOKEN_SECRET as string,{
        expiresIn:'15m'
    });
    return accessToken;
}

export const generateRefreshToken=async (userId:string):Promise<string>=>{
    const user=await db.select().from(login_Sessions).where(eq(login_Sessions.userId,parseInt(userId)));
    if(user.length>0){
        await db.delete(login_Sessions).where(eq(login_Sessions.userId,parseInt(userId)));
    }
    const refreshToken=jwt.sign({userId},process.env.REFRESH_TOKEN_SECRET as string,{
        expiresIn:'15d'
    });
    await db.insert(login_Sessions).values({
        userId:parseInt(userId),
        refreshToken,
        expiresAt:new Date(Date.now()+15*24*60*60*1000)
    });
    return refreshToken;
}