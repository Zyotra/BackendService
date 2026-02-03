const generatedDeploymentId = (): string => {
    const subset='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let deploymentId = 'dep_';
    for (let i = 0; i < 16; i++) {
        const randomIndex = Math.floor(Math.random() * subset.length);
        deploymentId += subset[randomIndex];
    }
    return deploymentId;
}
export default generatedDeploymentId;