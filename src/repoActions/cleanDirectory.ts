import SSHClient from "../SSHClient/SSHClient";

async function cleanDirectory(ssh: SSHClient, dirName: string): Promise<void> {
    await ssh.runSequential([`rm -rf ${dirName}`]);
}
export default cleanDirectory;