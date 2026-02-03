import SSHClient from "../SSHClient/SSHClient";
import socketManager from "../ws/socketManager";
import { saveLog } from "./saveLog";

const buildRepo = async (ssh: SSHClient, repoUrl: string, deploymentId: string, packageInstallerCommand: string, dirName: string, buildCommand?: string): Promise<boolean> => {
    try {
        const id = deploymentId;
        console.log("Installing dependencies and building the repository at directory:", dirName);
        
        // Check if it's a Python project
        const isPythonProject = packageInstallerCommand.includes('pip install') || packageInstallerCommand.includes('pip3 install');
        
        let Commands: string[] = [];
        
        if (isPythonProject) {
            await saveLog(id, `Setting up Python virtual environment...\n`, ssh);
            socketManager.emitLog(id, `Setting up Python virtual environment...\n`);
            
            // Python project - create venv and install deps inside it
            // IGNORE buildCommand if it's also a pip command (frontend might send it redundantly)
            const isPythonBuildCommand = buildCommand && (buildCommand.includes('pip install') || buildCommand.includes('pip3 install'));
            
            // Each command is atomic with proper fallbacks
            Commands = [
                // Create virtual environment - try multiple Python paths
                `cd ${dirName} && python3 -m venv venv 2>/dev/null || python -m venv venv 2>/dev/null || /usr/bin/python3 -m venv venv`,
                // Upgrade pip inside venv (non-blocking)
                `cd ${dirName} && ./venv/bin/pip install --upgrade pip -q 2>/dev/null || true`,
                // Install requirements inside venv
                `cd ${dirName} && ./venv/bin/${packageInstallerCommand}`,
                // Run build command ONLY if it's NOT a pip command (e.g., collectstatic, migrate, etc.)
                (buildCommand && !isPythonBuildCommand) ? `cd ${dirName} && ${buildCommand}` : undefined,
            ].filter(Boolean) as string[];
        } else {
            Commands = [
                `cd ${dirName} && ${packageInstallerCommand}`,
                buildCommand ? `cd ${dirName} && ${buildCommand}` : undefined,
            ].filter(Boolean) as string[];
        }
        
        console.log("Starting to build repository:", repoUrl, "with commands:", Commands);
        await saveLog(id, `Building repository with commands:\n${Commands.join('\n')}\n`, ssh);
        socketManager.emitLog(id, `Starting to build repository: ${repoUrl}\n`);
        
        await ssh.runSequential(Commands, async (logChunk) => {
            await saveLog(id, logChunk, ssh);
            socketManager.emitLog(id, logChunk);
        });
        
        console.log("Repository built successfully.");
        return true;
    } catch (error) {
        console.log("Error in cloneBuildRepo:", error);
        return false;
    }
}

export default buildRepo;