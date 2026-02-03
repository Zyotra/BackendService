import pool from "./pool";

async function unLinkDomain(domain: string): Promise<boolean | void> {
    try {
        const res=await pool.query(`UPDATE user_domains SET is_deployed = $1 WHERE domain_address = $2`, [0, domain]);
        return true;
    } catch (error) {
        console.error("Error unlinking domain:", error);
        return false;
    }
}
export default unLinkDomain;