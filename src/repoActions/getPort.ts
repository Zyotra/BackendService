const getPort=(env: Record<string,string>):number=>{
    const portEnv=env['PORT'] || env['port'];
    const port=portEnv ? parseInt(portEnv,10) : undefined;
    if(!port || isNaN(port)){
        throw new Error("Invalid or missing PORT in environment variables.");
    }
    return port;
}
export default getPort;