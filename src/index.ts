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
import startExistingRedisServer from "./controllers/storage-service/Redis/startExistingRedisServer";
import deleteRedisServer from "./controllers/storage-service/Redis/deleteRedisServer";
import stopRedisServer from "./controllers/storage-service/Redis/stopRedisServer";
import startNewRedis from "./controllers/storage-service/Redis/startNewRedis";
import getRedisServer from "./controllers/storage-service/Redis/getRedisServer";
import backupPostgres from "./controllers/storage-service/Postgres/backupPostgres";
import backupMySQL from "./controllers/storage-service/MySQL/backupMySQL";
import runMySQLQuery from "./controllers/storage-service/MySQL/runMySQLQuery";
import getMySQLTableData from "./controllers/storage-service/MySQL/getTableDataMySQL";
import getMySQLTableList from "./controllers/storage-service/MySQL/getMySQLTableList";
import deleteMySQL from "./controllers/storage-service/MySQL/deleteMySQL";
import deployMySQL from "./controllers/storage-service/MySQL/deployMySQL";
import runQuery from "./controllers/storage-service/Postgres/runQuery";
import getTableData from "./controllers/storage-service/Postgres/getTableData";
import getTablesListController from "./controllers/storage-service/Postgres/getTablesListController";
import getdbController from "./controllers/storage-service/Postgres/getdbController";
import deleteDatabaseController from "./controllers/storage-service/Postgres/deleteDatabaseController";
import deployPostgresController from "./controllers/storage-service/Postgres/deploy-postgres";
import addMachine from "./controllers/deployment-manager/Machines/addMachines";
import addNewDomain from "./controllers/deployment-manager/Domains/addNewDomain";
import updateMachine from "./controllers/deployment-manager/Machines/updateMachine";
import getMachines from "./controllers/deployment-manager/Machines/getMachines";
import getDomains from "./controllers/deployment-manager/Domains/getDomains";
import deleteMachine from "./controllers/deployment-manager/Machines/deleteMachine";
import deleteDomain from "./controllers/deployment-manager/Domains/deleteDomain";
import viewDetails from "./controllers/deployment-manager/Machines/viewDetails";
import authenticateGithubController from "./controllers/deployment-manager/Github/authenticateGithubController";
import unauthenticateGithubController from "./controllers/deployment-manager/Github/unauthenticateGithubController";
import getGithubStatusController from "./controllers/deployment-manager/Github/getGithubStatusController";
import startMySQLController from "./controllers/deployment-manager/Storage/startMySQLController";
import stopMySQLController from "./controllers/deployment-manager/Storage/stopMySQLController";
import startPostgresController from "./controllers/deployment-manager/Storage/startPostgresController";
import stopPostgresController from "./controllers/deployment-manager/Storage/stopPostgresController";
import startRedisController from "./controllers/deployment-manager/Storage/startRedisController";
import stopRedisController from "./controllers/deployment-manager/Storage/stopRedisController";
import createSwapMemoryController from "./controllers/deployment-manager/Storage/createSwapMemoryController";
config();
const app = new Elysia()
app.use(cors({
  origin: ["http://localhost:5173", "https://zyotraportal.ramkrishna.cloud","https://portal.zyotra.com"],
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
        const id = generateId();
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
  .get("/live-logs/:id", getLiveLogsController)
  .post("/deploy-ui", deployUIController)
  .get("/deploy-latest-ui-commit/:id", deployLatestCommitFrontendController)
  .post("/deploy-postgres", deployPostgresController)
  .delete("/delete-db/:id", deleteDatabaseController)
  .get("/get-db", getdbController)
  .post("/get-tables-list", getTablesListController)
  .post("/get-table-data", getTableData)
  .post("/run-query", runQuery)
  .post("/deploy-mysql", deployMySQL)
  .post("/delete-mysql", deleteMySQL)
  .post("/get-mysql-table-list", getMySQLTableList)
  .post("/get-mysql-table-data", getMySQLTableData)
  .post("/run-mysql-query", runMySQLQuery)
  .post("/backup-mysql-db", backupMySQL)
  .post("/backup-postgres-db", backupPostgres)
  .get("/get-redis-server", getRedisServer)
  .post("/deploy-redis", startNewRedis)
  .post("/stop-redis-server", stopRedisServer)
  .post("/delete-redis-server", deleteRedisServer)
  .post("/start-stopped-redis-server", startExistingRedisServer)
  .post("/add-machine", addMachine)
  .post("/add-domain", addNewDomain)
  .put("/update-machine/:id", updateMachine)
  .get("/get-machines", getMachines)
  .get("/get-domains", getDomains)
  .delete("/delete-machine/:id", deleteMachine)
  .delete("/delete-domain/:id", deleteDomain)
  .get("/get-machine-analytics/:id", viewDetails)
  .post("/authenticate-github/:id", authenticateGithubController)
  .get("/unauthenticate-github/:id", unauthenticateGithubController)
  .get("/get-github-auths/:id", getGithubStatusController)
  .post("/create-swap-memory", createSwapMemoryController)
  .get("/stop-redis/:id", stopRedisController)
  .get("/start-redis/:id", startRedisController)
  .get("/stop-postgres/:id", stopPostgresController)
  .get("/start-postgres/:id", startPostgresController)
  .get("/stop-mysql/:id", stopMySQLController)
  .get("/start-mysql/:id", startMySQLController);
app.listen(Number(process.env.PORT));
serverStore.server = app.server;
console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);

