import pool from "../db/pool"
const getCredentials = async (vpsId: string) => {
    try {
        console.log("Fetching credentials for VPS ID:", vpsId);
        const res=await pool.query(`
            SELECT * FROM vps_machines WHERE id = $1
        `, [vpsId]);
        if (res.rows.length === 0) {
            return null;
        }
        return res.rows[0];
    } catch (error) {
        console.error("Error fetching credentials:", error);
        throw new Error("Failed to fetch credentials");
    }
}
export default getCredentials;