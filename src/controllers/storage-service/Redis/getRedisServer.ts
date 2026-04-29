import { Context } from "elysia";
import { db } from "../../../db/client";
import { caching } from "../../../db/schema";
import { eq } from "drizzle-orm";
import { StatusCode } from "../../../types/types";

const getRedisServer=async({set,userId}:Context|any)=>{
    try {
        const redisServers=await db.select({
            id:caching.id,
            cacheName:caching.cacheName,
            password:caching.password,
            host:caching.host,
            port:caching.port,
            vpsId:caching.vpsId,
            cachingType:caching.cachingType,
            status:caching.status,
            userId:caching.userId,
            createdAt:caching.createdAt
        }).from(caching).where(eq(caching.userId,parseInt(userId)))
        set.status=StatusCode.OK
        return{
            message:"Redis Server Fetched Successfully.",
            data:redisServers
        }
    } catch (error) {
        console.log("Error while fetching redis server",error)
        set.status=StatusCode.INTERNAL_SERVER_ERROR
        return{
            messages:"Error while fetching redis server",
            error:error
        }
    }
}
export default getRedisServer