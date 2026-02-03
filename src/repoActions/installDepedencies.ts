import dockerDepedenciesInstaller from "../depedenciesInstaller/dockerDepedenciesInstaller";
import jsDepedenciesInstaller from "../depedenciesInstaller/jsDepedenciesInstaller";
import installPythonDependencies from "../depedenciesInstaller/pyhtonDepedenciesInstaller";
import installSpringBootDependencies from "../depedenciesInstaller/springBootDepedenciesInstaller";
import installRustDependencies from "../depedenciesInstaller/rustDepedenciesInstaller";
import installGoDependencies from "../depedenciesInstaller/goDepedenciesInstaller";
import installDotnetDependencies from "../depedenciesInstaller/dotnetDepedenciesInstaller";
import SSHClient from "../SSHClient/SSHClient";

async function installDependencies(ssh: SSHClient, framework: string, deploymentId?: string): Promise<boolean> {
    let result: boolean
    try {
        if (framework.toLowerCase() == "nodejs" || framework.toLowerCase() == "express" || framework.toLowerCase() == "nextjs" || framework.toLowerCase() == "nestjs" || framework.toLowerCase() == "bunjs" || framework.toLowerCase() == "elysia-js") {
            result = await jsDepedenciesInstaller(ssh)
        } else if (framework.toLowerCase() == "python" || framework.toLowerCase() == "django" || framework.toLowerCase() == "flask" || framework.toLowerCase() == "fastapi" || framework.toLowerCase() == "flask-restful" || framework.toLowerCase() == "dotenv") {
            result = await installPythonDependencies(ssh)
        } else if (framework.toLowerCase() === "docker") {
            result = await dockerDepedenciesInstaller(ssh);
        } else if (framework.toLowerCase() === "spring-boot" || framework.toLowerCase() === "spring boot" || framework.toLowerCase() === "springboot") {
            result = await installSpringBootDependencies(ssh);
        } else if (framework.toLowerCase() === "rust") {
            result = await installRustDependencies(ssh);
        } else if (framework.toLowerCase() === "go" || framework.toLowerCase() === "golang") {
            result = await installGoDependencies(ssh);
        } else if (framework.toLowerCase() === "dotnet" || framework.toLowerCase() === ".net" || framework.toLowerCase() === "csharp" || framework.toLowerCase() === "aspnet" || framework.toLowerCase() === "asp.net") {
            result = await installDotnetDependencies(ssh, deploymentId);
        }
        else {
            result = false
        }
        return result;

    } catch (error) {
        console.log("Error in installDependencies:", error);
        return false;
    }
}

export default installDependencies;