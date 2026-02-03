const generateId=():string=>{
    const subset="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let id="";
    for(let i=0;i<8;i++){
        const randomIndex=Math.floor(Math.random()*subset.length);
        id+=subset[randomIndex];
    }
    return id;
}
export default generateId;