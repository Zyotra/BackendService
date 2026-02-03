import pool from "../db/pool";

export const getMachineDetail = async (vps_ip: string, userId: string) => {
    // Query by vps_ip column, not id column
    const res = await pool.query(
        'SELECT * FROM vps_machines WHERE vps_ip = $1',
        [vps_ip]
    );
    
    if (res.rowCount === 0) {
        return null;
    }
    return res.rows[0];
}

export default getMachineDetail;