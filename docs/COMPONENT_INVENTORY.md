# Component Inventory

This document lists the key components of the DeploymentService, their file locations, and responsibilities.

## 1. Core Service (Root)
- **Entry Point**: `src/index.ts`
  - Initializes Elysia server
  - Sets up WebSocket server (`/deploy-logs`)
  - Configures CORS and middlewares
  - Defines routes
- **Configuration**:
  - `package.json`: Dependencies and scripts (Bun runtime).
  - `drizzle.config.ts`: Drizzle ORM configuration.
  - `.env`: Environment variables (Ports, Keys, DB URLs).

## 2. Controllers (Service Modules)

### A. Deployment Manager (`src/controllers/deployment-manager`)
Manages the infrastructure (VPS) and the deployment lifecycle of services.

#### 1. Machines (`src/controllers/deployment-manager/Machines`)
Manage VPS instances.
- `addMachines.ts`: Add a new VPS.
- `deleteMachine.ts`: Remove a VPS.
- `getMachines.ts`: List available VPSs.
- `updateMachine.ts`: Update VPS details.
- `viewDetails.ts`: Get detailed VPS info.

#### 2. Domains (`src/controllers/deployment-manager/Domains`)
Manage domain mapping.
- `deleteDomain.ts`: Unlink/delete a domain.
- `addDomain.ts` (Implied): Logic for adding domains often integrated in deployment.

#### 3. Storage (Infrastructure) (`src/controllers/deployment-manager/Storage`)
Manage system-level storage services on VPS.
- `createSwapMemoryController.ts`: Adds swap to VPS.
- `startMySQLController.ts` / `stopMySQLController.ts`: Manage MySQL service.
- `startPostgresController.ts` / `stopPostgresController.ts`: Manage Postgres service.
- `startRedisController.ts` / `stopRedisController.ts`: Manage Redis service.

#### 4. Github (`src/controllers/deployment-manager/Github`)
GitHub integration (likely for automatic deployments).

### B. Web Service (`src/controllers/web-service`)
Handles the "Web Service" project type (Node/Bun/Python apps).
- `deployWebServiceController.ts`: Core logic to deploy a web app (Clone -> Build -> Start -> Nginx -> Certbot).
- `deployLatestCommitController.ts`: Redeploy existing app with latest code.
- `deleteProjectsController.ts`: Remove a project.
- `getProjectsController.ts`: List user projects.
- `getLiveLogsController.ts`: Fetch logs.
- `getActivityLogsController.ts`: Audit trail of deployments.

### C. UI Service (`src/controllers/ui-service`)
Handles "Static UI" project type (React/Vue/etc. -> Static HTML).
- `deployUIController.ts`: Deploy static sites.
- `deployLatestCommitController.ts`: Redeploy UI.
- `getDeploymentLogsController.ts`: Logs for UI deployments.

### D. Storage Service (Managed DBs) (`src/controllers/storage-service`)
Provides "Database as a Service" features for users.
- **Postgres** (`src/controllers/storage-service/Postgres`):
  - `deploy-postgres.ts`: Provision a Postgres DB.
  - `backupPostgres.ts`: Create backups.
  - `runQuery.ts`: Execute SQL queries via API.
  - `getTableData.ts`, `getTablesListController.ts`: Data explorer.
  - `deleteDatabaseController.ts`: Remove DB.
- **MySQL** (`src/controllers/storage-service/MySQL`): Similar capabilities for MySQL.
- **Redis** (`src/controllers/storage-service/Redis`): Similar capabilities for Redis.

### E. Auth Service (`src/controllers/auth-service`)
User authentication and management.
- `registerController.ts`: User signup.
- `loginController.ts`: User login (JWT).
- `getAccessTokenController.ts`: Refresh/Get token.
- `sendOtpController.ts`: OTP logic (likely for verify/reset).
- `dashboardController.ts`: User dashboard data.

## 3. Core Database Layer (`src/db`)
- `client.ts`: Drizzle ORM client instance.
- `pool.ts`: Raw Postgres connection pool.
- `schema.ts`: Database schema definitions (Users, Deployments, Activities).
- `saveActivity.ts`: Helper to log deployment activities.
- `checkDomainValidity.ts`: Domain availability check.

## 4. SSH & Remote Execution (`src/SSHClient`)
- `SSHClient.ts`: Wrapper around `ssh2`. Handles connection, command execution (`exec`, `runSequential`), and stream handling.

## 5. Repository Actions (`src/repoActions`)
Reusable automation scripts executed over SSH.
- `cloneRepo.ts`, `cloneBuildRepo.ts`: Git operations.
- `injectEnv.ts`: Write environment variables.
- `injectNginxConfig.ts`: Configure Nginx reverse proxy.
- `enableDomain.ts`: Certbot SSL setup.
- `startWebService.ts`: PM2 process management.
- `cleanDirectory.ts`: Cleanup.

## 6. Utilities & Helpers (`src/utils`, `src/ws`)
- `src/ws/socketManager.ts`: WebSocket log streaming.
- `src/bucket/s3.ts`: AWS S3 client (Artifact storage).
- `src/jwt/verifyTokens.ts`: JWT verification logic.
- `src/utils/decryptPassword.ts`: AES decryption for VPS credentials.
