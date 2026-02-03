import serverStore from "./store";

class SocketManager {
    public emitLog(deploymentId: string, log: string) {
        if (!serverStore.server) {
            console.error("❌ CRITICAL: SocketManager.server is UNDEFINED. Call serverStore.server = app.server in index.ts");
            return;
        }
        const message = JSON.stringify({ type: "LOG", log });
        const bytesSent = serverStore.server.publish(deploymentId, message);
        console.log(`📡 SocketManager: Publishing to channel [${deploymentId}] | Bytes sent: ${bytesSent}`);
        if (bytesSent === 0) {
            console.warn(`⚠️ Warning: Message was sent to channel [${deploymentId}] but 0 subscribers received it.`);
        }
    }
}

export default new SocketManager();