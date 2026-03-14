import SSHClient from "../SSHClient/SSHClient";

async function installSpringBootDependencies(ssh: SSHClient): Promise<boolean> {
    try {
        const springBootInstallCommands: string[] = [
            // 1. System update and install all Java/build tools in one batch
            "sudo apt update && sudo apt install -y build-essential curl wget git openjdk-21-jdk openjdk-21-jre maven gradle nginx --no-install-recommends",

            // 2. Create Java symlinks
            `JAVA_HOME=$(dirname $(dirname $(readlink -f $(which java) 2>/dev/null) 2>/dev/null) 2>/dev/null) && \
[ -n \"\\$JAVA_HOME\" ] && (
  [ -x \\$JAVA_HOME/bin/java ] && sudo ln -sf \\$JAVA_HOME/bin/java /usr/local/bin/java || true
  [ -x \\$JAVA_HOME/bin/javac ] && sudo ln -sf \\$JAVA_HOME/bin/javac /usr/local/bin/javac || true
) || true && \
[ -x /usr/bin/mvn ] && sudo ln -sf /usr/bin/mvn /usr/local/bin/mvn || true && \
[ -x /usr/bin/gradle ] && sudo ln -sf /usr/bin/gradle /usr/local/bin/gradle || true`,

            // 3. Install Node.js and PM2 if not present
            `command -v pm2 >/dev/null 2>&1 || (
  curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && \
  sudo apt install -y nodejs --no-install-recommends && \
  sudo npm install -g pm2 && \
  pm2 startup systemd -u root --hp /root 2>/dev/null || true
)`,

            // 4. Start Nginx and enable services
            "sudo systemctl start nginx && sudo systemctl enable nginx",

            // 5. Final verification (all at once)
            `echo "=== Spring Boot Dependencies Install Complete ===" && \
java -version 2>&1 && \
javac -version 2>&1 && \
mvn -version && \
gradle -version && \
nginx -v 2>&1 && \
git --version && \
echo "=== Ready to deploy Spring Boot applications ==="`,
        ];

        await ssh.runSequential(springBootInstallCommands, (logChunk) => {
            console.log("Spring Boot Install Log:", logChunk);
        });

        return true;
    } catch (error) {
        console.log("Error in installSpringBootDependencies:", error);
        return false;
    }
}

export default installSpringBootDependencies;
