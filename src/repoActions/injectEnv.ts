import SSHClient from "../SSHClient/SSHClient";
import socketManager from "../ws/socketManager";
import { saveLog } from "./saveLog";

const injectEnv = async (ssh: SSHClient, env: Record<string, string>, repoDirectoryName: string, deploymentId: string, projectType?: string): Promise<boolean> => {
    try {
        console.log("Setting up environment variables...");

        if (!env || Object.keys(env).length === 0) {
            console.log("No environment variables provided. Skipping .env creation.");
            return true;
        }

        // Filter out PORT for frameworks that use command-line args for port configuration
        // FastAPI, Flask, Django get port via --port or --bind flags, not env vars
        const filteredEnv = { ...env };
        if (projectType === "fastapi" || projectType === "flask" || projectType === "django") {
            delete filteredEnv.PORT;
            delete filteredEnv.port;
            console.log(`Filtered out PORT from .env for ${projectType} (port is passed via command-line)`);
        }

        if (Object.keys(filteredEnv).length === 0) {
            console.log("No environment variables to inject after filtering.");
            return true;
        }

        const envLines = Object.entries(filteredEnv).map(([key, value]) => {
            return `${key}=${value}`;
        });

        const envContent = envLines.join('\\n'); // Use \\n for printf to interpret newline

        // 2. Escape double quotes inside the content to prevent breaking the shell command
        // If value is 'Hello "World"', it becomes 'Hello \"World\"'
        const safeContent = envContent.replace(/"/g, '\\"');

        // 3. Construct the command
        // We use 'printf' because it handles newlines reliably across different Linux distros
        // 'cd' ensures we create the file in the right folder
        const command = `cd ${repoDirectoryName} && printf "${safeContent}" > .env`;

        console.log(`Writing .env file to ${repoDirectoryName}...`);
        await saveLog(deploymentId, "Writing .env file to ${repoDirectoryName}...", ssh)
        const result = await ssh.exec(command, async (logChunk) => {
            console.log("SSH Log:", logChunk);
            await saveLog(deploymentId, logChunk, ssh)
            await socketManager.emitLog(deploymentId, logChunk);
        });

        if (result.exitCode !== 0) {
            throw new Error(`Failed to write .env file: ${result.output}`);
        }

        console.log(".env file created successfully.");
        return true;

    } catch (error) {
        console.error("Error in envSetup:", error);
        return false;
    }
}

export default injectEnv;