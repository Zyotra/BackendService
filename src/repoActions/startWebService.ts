import SSHClient from "../SSHClient/SSHClient";
import socketManager from "../ws/socketManager";

const startWebService = async (ssh: SSHClient, repoDirectoryName: string, serverFilePath: string, deploymentId: string, projectType?: string, env?: Record<string, string>) => {
    try {
        const bunStartCommand = [
            `pm2 delete ${repoDirectoryName} 2> /dev/null || true`,
            `cd ${repoDirectoryName} && pm2 start bun --name ${repoDirectoryName} -- run dist/index.js`,
            `pm2 save`
        ];
        const startCommands = [
            `pm2 delete ${repoDirectoryName} 2> /dev/null || true`,
            `cd ${repoDirectoryName} && pm2 start ${serverFilePath} --name ${repoDirectoryName}`,
            `pm2 save`
        ]

        if (projectType === "elysia-js" || projectType == "bun") {
            await ssh.runSequential(bunStartCommand, (logChunk) => {
                socketManager.emitLog(deploymentId, logChunk);
            });
            return true;
        } else if (projectType === "django") {
            const port = env?.PORT || "8000";
            const djangoStartCommands = [
                // Venv already created by buildRepo, just install gunicorn if missing
                `cd ${repoDirectoryName} && venv/bin/pip install -q gunicorn 2>/dev/null || true`,
                // Run migrations
                `cd ${repoDirectoryName} && venv/bin/python manage.py migrate --noinput 2>/dev/null || true`,
                // Collect static files
                `cd ${repoDirectoryName} && venv/bin/python manage.py collectstatic --noinput 2>/dev/null || true`,
                // Delete existing PM2 process
                `pm2 delete ${repoDirectoryName} 2>/dev/null || true`,
                // Start gunicorn with PM2
                `cd ${repoDirectoryName} && pm2 start venv/bin/gunicorn --name ${repoDirectoryName} --interpreter none -- ${serverFilePath} --bind 0.0.0.0:${port} --workers 2`,
                `pm2 save`
            ];
            await ssh.runSequential(djangoStartCommands, (logChunk) => {
                socketManager.emitLog(deploymentId, logChunk);
            });
            return true;
        } else if (projectType === "flask") {
            const port = env?.PORT || "5000";
            // Convert file path to module format (app/main.py -> app.main:app)
            const moduleFormat = serverFilePath.replace(/\.py$/, '').replace(/\//g, '.') + ':app';
            const flaskStartCommands = [
                // Venv already created by buildRepo, just install gunicorn if missing
                `cd ${repoDirectoryName} && venv/bin/pip install -q gunicorn 2>/dev/null || true`,
                // Delete existing PM2 process
                `pm2 delete ${repoDirectoryName} 2> /dev/null || true`,
                // Start gunicorn with PM2
                `cd ${repoDirectoryName} && pm2 start venv/bin/gunicorn --name ${repoDirectoryName} --interpreter none -- ${moduleFormat} --bind 0.0.0.0:${port} --workers 2`,
                `pm2 save`
            ];
            await ssh.runSequential(flaskStartCommands, (logChunk) => {
                socketManager.emitLog(deploymentId, logChunk);
            });
            return true;
        } else if (projectType === "fastapi") {
            const port = env?.PORT || "8000";
            // Convert file path to module format (app/main.py -> app.main:app)
            const moduleFormat = serverFilePath.replace(/\.py$/, '').replace(/\//g, '.') + ':app';
            const fastapiStartCommands = [
                // Install uvicorn
                `cd ${repoDirectoryName} && venv/bin/pip install -q uvicorn 2>/dev/null || true`,
                // Delete existing PM2 process
                `pm2 delete ${repoDirectoryName} 2> /dev/null || true`,
                // Start uvicorn directly with PM2 (PORT filtered out from .env by injectEnv)
                `cd ${repoDirectoryName} && pm2 start venv/bin/uvicorn --name ${repoDirectoryName} --interpreter none -- ${moduleFormat} --host 0.0.0.0 --port ${port}`,
                `pm2 save`
            ];
            await ssh.runSequential(fastapiStartCommands, (logChunk) => {
                socketManager.emitLog(deploymentId, logChunk);
            });
            return true;
        } else if (projectType === "spring-boot") {
            const port = env?.PORT || "8080";
            const springBootStartCommands = [
                // Delete existing PM2 process
                `pm2 delete ${repoDirectoryName} 2> /dev/null || true`,
                // Build JAR - try Maven first, then Gradle
                `cd ${repoDirectoryName} && (test -f pom.xml && mvn clean package -DskipTests -q) || (test -f build.gradle && gradle build -x test --quiet) || echo "No build file found"`,
                // Start Spring Boot with PM2 (find JAR in target/ or build/libs/)
                `cd ${repoDirectoryName} && JAR_FILE=$(find target build/libs -name "*.jar" 2>/dev/null | grep -v sources | grep -v javadoc | grep -v original | head -1) && pm2 start "java -jar $JAR_FILE --server.port=${port}" --name ${repoDirectoryName}`,
                `pm2 save`
            ];
            await ssh.runSequential(springBootStartCommands, (logChunk) => {
                socketManager.emitLog(deploymentId, logChunk);
            });
            return true;
        } else if (projectType === "rust") {
            const port = env?.PORT || "8000";
            const rustStartCommands = [
                // Delete existing PM2 process
                `pm2 delete ${repoDirectoryName} 2> /dev/null || true`,
                // Build release binary
                `cd ${repoDirectoryName} && source $HOME/.cargo/env && cargo build --release`,
                // Find binary name from Cargo.toml and start with PM2
                `cd ${repoDirectoryName} && BINARY_NAME=$(grep '^name = ' Cargo.toml | head -1 | cut -d'"' -f2 | tr '-' '_') && ROCKET_ADDRESS=0.0.0.0 ROCKET_PORT=${port} pm2 start ./target/release/$BINARY_NAME --name ${repoDirectoryName} --interpreter none`,
                `pm2 save`
            ];
            await ssh.runSequential(rustStartCommands, (logChunk) => {
                socketManager.emitLog(deploymentId, logChunk);
            });
            return true;
        } else if (projectType === "go") {
            const port = env?.PORT || "8000";
            const goStartCommands = [
                // Delete existing PM2 process
                `pm2 delete ${repoDirectoryName} 2> /dev/null || true`,
                // Build Go binary
                `cd ${repoDirectoryName} && go build -o app .`,
                // Start Go binary with PM2
                `cd ${repoDirectoryName} && PORT=${port} pm2 start ./app --name ${repoDirectoryName} --interpreter none`,
                `pm2 save`
            ];
            await ssh.runSequential(goStartCommands, (logChunk) => {
                socketManager.emitLog(deploymentId, logChunk);
            });
            return true;
        } else if (projectType === "dotnet" || projectType === ".net" || projectType === "aspnet") {
            const port = env?.PORT || "5000";
            const dotnetStartCommands = [
                // Delete existing PM2 process
                `pm2 delete ${repoDirectoryName} 2> /dev/null || true`,
                // Restore and publish the app
                `cd ${repoDirectoryName} && dotnet restore && dotnet publish -c Release -o ./publish`,
                // Find the DLL and start with PM2
                `cd ${repoDirectoryName} && DLL_FILE=$(ls publish/*.dll | grep -v "Microsoft" | grep -v "System" | head -1) && pm2 start "dotnet $DLL_FILE --urls http://0.0.0.0:${port}" --name ${repoDirectoryName}`,
                `pm2 save`
            ];
            await ssh.runSequential(dotnetStartCommands, (logChunk) => {
                socketManager.emitLog(deploymentId, logChunk);
            });
            return true;
        } else if (projectType === "dotenv") {
            const startCommandsWithEnv = [
                `pm2 delete ${repoDirectoryName} 2> /dev/null || true`,
                `cd ${repoDirectoryName} && pm2 start ${serverFilePath} --name ${repoDirectoryName}`,
                `pm2 save`
            ];
            await ssh.runSequential(startCommandsWithEnv, (logChunk) => {
                socketManager.emitLog(deploymentId, logChunk);
            });
            return true;
        } else {
            await ssh.runSequential(startCommands, (logChunk) => {
                socketManager.emitLog(deploymentId, logChunk);
            });
            return true;
        }
    } catch (error) {
        console.log("Error in startWebService:", error);
        return false;
    }
}
export default startWebService;