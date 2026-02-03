import simpleGit from "simple-git"

const checkUrl = async(repoUrl:string):Promise<boolean>=>{
    try {
        await simpleGit().listRemote([repoUrl]);
        return true;
    } catch {
        return false;
    }
}
export default checkUrl;