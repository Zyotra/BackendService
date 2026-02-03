import { Elysia } from "elysia";
import { config } from "dotenv";
import { StatusCode } from "./types/types";
import checkAuthPlugin from "./middlewares/checkAuth";
import serverStore from "./ws/store";
import verifyMachine from "./utils/verifyMachine";
import generatedDeploymentId from "./utils/generatedDeploymentId";
import verifyAccessToken from "./jwt/verifyTokens";
import deployWebServiceController from "./controllers/web-service/deployWebServiceController";
import { cors } from "@elysiajs/cors";
import getProjectsController from "./controllers/web-service/getProjectsController";
import deleteProjectsController from "./controllers/web-service/deleteProjectsController";
import getActivityLogsController from "./controllers/web-service/getActivityLogsController";
import deployLatestCommitController from "./controllers/web-service/deployLatestCommitController";
import getDeploymentLogController from "./controllers/web-service/getDeploymentLogController";
import generateId from "./utils/generateId";
import getLiveLogsController from "./controllers/web-service/getLiveLogsController";
import deployUIController from "./controllers/ui-service/deployUIController";
import deployLatestCommitFrontendController from "./controllers/ui-service/deployLatestCommitController";
config();
const app = new Elysia()
app.use(cors({
  origin: ["http://localhost:5173", "https://zyotraportal.ramkrishna.cloud"],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}))
app.get("/", ({ set }) => {
  set.status = StatusCode.OK
  return {
    status: "success",
    message: "Deployment Service Backend of Zyotra is running.",
    Time: new Date().toISOString()
  }
})
app
  .ws("/deploy-logs", {
    async open(ws) {
      try {
        const token = ws.data.query.token as string;
        const machineId = ws.data.query.machineId as string;
        if (!token || !machineId || token.length === 0 || machineId.length === 0) {
          ws.close(1008, "Missing token or machineId");
          return;
        }
        const user = await verifyAccessToken(token) as { userId: string };
        const isMachineValid = await verifyMachine(machineId, user?.userId);
        if (!isMachineValid) {
          ws.close(1008, "Unauthorized Machine Access");
          return;
        }
        const deploymentId = generatedDeploymentId();
        console.log("WebSocket connection request received");
        ws.subscribe(deploymentId);
        console.log("Subscribing to deployment ID:", deploymentId);
        ws.send(JSON.stringify({
          type: "DEPLOYMENT_ID",
          deploymentId: deploymentId
        }));
        console.log("WebSocket connection established");
      } catch (err) {
        console.error("Error during WebSocket connection:", err);
        ws.close(1011, "Internal Server Error");
      }
    },
    close(ws, code, reason) {
      console.log(`WebSocket closed: Code=${code}, Reason=${reason}`);
    }
  })
  .ws("/live-logs", {
    async open(ws) {
      try {
        const token = ws.data.query.token as string;
        const machineId = ws.data.query.machineId as string;
        if (!token || !machineId || token.length === 0 || machineId.length === 0) {
          ws.close(1008, "Missing token or machineId");
          return;
        }
        const user = await verifyAccessToken(token) as { userId: string };
        const isMachineValid = await verifyMachine(machineId, user?.userId);
        if (!isMachineValid) {
          ws.close(1008, "Unauthorized Machine Access");
          return;
        }
        console.log("WebSocket connection request received for live logs");
        const id=generateId();
        ws.subscribe(id);
        console.log("Subscribing to logs ID for live logs:", id);
        ws.send(JSON.stringify({
          type: "MACHINE_ID",
          logsId: id
        }));
        console.log("WebSocket connection established for live logs");
      } catch (err) {
        console.error("Error during WebSocket connection for live logs:", err);
        ws.close(1011, "Internal Server Error");
      }
    }
  })
app
  .use(checkAuthPlugin)
  .post("/deploy-webservice", deployWebServiceController)
  .get("/get-projects", getProjectsController)
  .delete("/delete-project/:id", deleteProjectsController)
  .get("/get-activity-logs", getActivityLogsController)
  .get("/deploy-latest-commit/:id", deployLatestCommitController)
  .get("/get-deployment-log/:id", getDeploymentLogController)
  .get("/live-logs/:id",getLiveLogsController)
  .post("/deploy-ui", deployUIController)
  .get("/deploy-latest-ui-commit/:id", deployLatestCommitFrontendController)
app.listen(Number(process.env.PORT));
serverStore.server = app.server;
console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);

