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
    const frameworkLower = framework.toLowerCase();
    try {
        // JavaScript/Node.js based frameworks (both backend and frontend)
        const jsFrameworks = [
            "nodejs", "express", "nextjs", "nestjs", "bunjs", "elysia-js",
            // Frontend frameworks that need Node.js for building
            "react", "vue", "angular", "svelte", "nuxtjs", "gatsby", "vite", "other"
        ];
        
        if (jsFrameworks.includes(frameworkLower)) {
            result = await jsDepedenciesInstaller(ssh)
        } else if (frameworkLower == "python" || frameworkLower == "django" || frameworkLower == "flask" || frameworkLower == "fastapi" || frameworkLower == "flask-restful" || frameworkLower == "dotenv") {
            result = await installPythonDependencies(ssh)
        } else if (frameworkLower === "docker") {
            result = await dockerDepedenciesInstaller(ssh);
        } else if (frameworkLower === "spring-boot" || frameworkLower === "spring boot" || frameworkLower === "springboot") {
            result = await installSpringBootDependencies(ssh);
        } else if (frameworkLower === "rust") {
            result = await installRustDependencies(ssh);
        } else if (frameworkLower === "go" || frameworkLower === "golang") {
            result = await installGoDependencies(ssh);
        } else if (frameworkLower === "dotnet" || frameworkLower === ".net" || frameworkLower === "csharp" || frameworkLower === "aspnet" || frameworkLower === "asp.net") {
            result = await installDotnetDependencies(ssh, deploymentId);
        } else if (frameworkLower === "plainhtml" || frameworkLower === "htmlcssjs" || frameworkLower === "html") {
            // Plain HTML doesn't need any dependencies - just nginx which should already be installed
            result = true;
        }
        else {
            console.log(`Unknown framework: ${framework}, attempting JS dependencies as fallback`);
            result = await jsDepedenciesInstaller(ssh);
        }
        return result;

    } catch (error) {
        console.log("Error in installDependencies:", error);
        return false;
    }
}

export default installDependencies;