import SSHClient from "../SSHClient/SSHClient";

async function installSpringBootDependencies(ssh: SSHClient): Promise<boolean> {
    try {
        const springBootInstallCommands: string[] = [
            // Update system
            "sudo apt update && sudo apt upgrade -y",

            // Install prerequisites
            "sudo apt install -y curl wget git build-essential",

            // Install Git
            "sudo apt install git -y",

            // Install Java (OpenJDK 21 LTS - latest stable)
            "sudo apt install -y openjdk-21-jdk openjdk-21-jre",

            // Verify Java installation
            "java -version",
            "javac -version",

            // Install Maven
            "sudo apt install -y maven",

            // Verify Maven
            "mvn -version",

            // Install Gradle
            "sudo apt install -y gradle",

            // Verify Gradle
            "gradle -version",

            // Install Nginx (for reverse proxy)
            "sudo apt install nginx -y",
            "sudo systemctl start nginx",
            "sudo systemctl enable nginx",

            // Install Node.js and PM2 for process management
            "curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt install -y nodejs",
            "sudo npm install -g pm2",
            "pm2 startup systemd -u root --hp /root || true",

            // Create symlinks for Java tools (detect architecture dynamically)
            "JAVA_HOME=$(dirname $(dirname $(readlink -f $(which java)))) && sudo ln -sf $JAVA_HOME/bin/java /usr/local/bin/java || true",
            "JAVA_HOME=$(dirname $(dirname $(readlink -f $(which java)))) && sudo ln -sf $JAVA_HOME/bin/javac /usr/local/bin/javac || true",
            "sudo ln -sf /usr/bin/mvn /usr/local/bin/mvn || true",
            "sudo ln -sf /usr/bin/gradle /usr/local/bin/gradle || true",

            // Verify installations
            'echo "================================"',
            'echo "Spring Boot Dependencies Install Complete!"',
            'echo "================================"',
            'java -version',
            'javac -version',
            'mvn -version',
            'gradle -version',
            'nginx -v',
            'git --version',
            'echo "================================"',
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
