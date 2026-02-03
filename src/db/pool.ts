import { Pool } from "pg";
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,                              // Increased pool size
    connectionTimeoutMillis: 180 * 1000,   // 30 seconds to connect
    idleTimeoutMillis: 180 * 1000,         // 60 seconds idle timeout
    statement_timeout: 180 * 1000,          // 60 seconds query timeout
    query_timeout: 180 * 1000,             // Alternative query timeout
})
export default pool;