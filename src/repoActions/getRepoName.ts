const getRepoName =  (repoUrl: string): string => {
    const repo=repoUrl.split("/");
    const repoNameWithGit=repo[repo.length-1];
    const repoName=repoNameWithGit.replace(".git","") ;
    return repoName;
}
export default getRepoName;