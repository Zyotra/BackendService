import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const client = postgres((process.env.DATABASE_URL as string),{
    max:10,
    idle_timeout:180,
    connect_timeout:180,
    prepare:false
});
export const db = drizzle(client);