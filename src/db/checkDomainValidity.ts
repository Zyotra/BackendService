import pool from "./pool";

async function checkDomainValidity(domain: string): Promise<boolean | void> {
    try {
        const res=await pool.query(`SELECT * FROM user_domains WHERE domain_address = $1 AND is_deployed = $2`, [domain,0]);
        if(res.rows.length>0){
            return true;
        }else{
            return false;
        }
    } catch (error) {
        console.error("Error checking domain validity:", error);
        return false;
    }
}
export default checkDomainValidity;