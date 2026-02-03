# DeploymentService - Zyotra

High-level overview

- Purpose: Backend service for automated deployments of web services and static sites to user VPS machines. Provides REST endpoints to trigger deployments, list projects, delete projects and get activity logs. Also exposes a WebSocket endpoint for live deployment logs.
- Language & runtime: TypeScript targeting Bun/Node (uses Elysia framework, Bun server types present)
- Primary integrations:
  - PostgreSQL (via `drizzle-orm` + `postgres` and `pg` Pool)
  - SSH to user VPS (custom `SSHClient` using `ssh2`)
  - Nginx + Certbot actions executed over SSH
  - S3-compatible storage for artifact URLs (`@aws-sdk/client-s3`)

Quick start

1. Create a `.env` with required variables (see Codebase docs below for full list). Important env keys: `PORT`, `DATABASE_URL`, `DEPLOY_DATABASE_URL`, `BASE_DIR`, `ACCESS_TOKEN_SECRET`, `ENCRYPTION_KEY`, `S3_REGION`, `S3_ENDPOINT`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY`.
2. Install dependencies and run the service (project uses Bun in many scripts but works under node):

```bash
# using npm (example)
npm install
npm run build
node build/index.js
```

Or with Bun (if used in this workspace):

```bash
bun install
bun run src/index.ts
```

Main endpoints (summary)

- `GET /` - Health check
- `POST /deploy-webservice` - Trigger a webservice deployment (protected)
- `GET /get-projects` - List deployments for authenticated user (protected)
- `DELETE /delete-project/:id` - Delete a deployed project (protected)
- `GET /get-activity-logs` - List activity logs (protected)
- `WS /deploy-logs` - WebSocket for streaming logs during deployment (requires token+machineId query params)

Security & data

- Authentication: cookie-based access token validated by `verifyTokens`. Protected routes use `checkAuth` middleware.
- DB operations use parameterized queries or `drizzle-orm` (prevents SQL injection when used correctly).
- VPS credentials stored encrypted and decrypted with `ENCRYPTION_KEY` using AES.

Where to look next

- Server entrypoint: [src/index.ts](src/index.ts)
- Controllers: [src/controllers](src/controllers)
- SSH interactions: [src/SSHClient/SSHClient.ts](src/SSHClient/SSHClient.ts)
- Repo actions and deployment orchestration: [src/repoActions](src/repoActions)
- DB schema: [src/db/schema.ts](src/db/schema.ts)

For full per-file documentation, see CODEBASE_DOCUMENTATION.md

# DeploymentService

Automated deployment backend for VPS servers, built with [Elysia](https://elysiajs.com/) and [Bun](https://bun.sh/). It supports secure deployments, real-time logs via WebSocket, S3 file downloads, Nginx configuration, and SSL certificate management.

---

## Features

- REST API for deployment, build, repo management
- WebSocket for real-time deployment logs
- SSH automation for remote VPS operations
- S3 integration for build artifact download
- Nginx config & SSL certificate automation
- JWT-based authentication
- Credential encryption/decryption

---

## Folder Structure & Key Modules

### `src/index.ts`
Main entrypoint. Sets up Elysia server, routes, WebSocket, authentication, and deployment controller.

### `src/controllers/deployController.ts`
Handles deployment requests:
- Authenticates user
- Fetches VPS credentials from DB (`db/pool.ts`)
- Decrypts password (`utils/decryptPassword.ts`)
- Connects via SSH (`SSHClient/SSHClient.ts`)
- Clones repo (`repoActions/cloneBuildRepo.ts`)
- Installs dependencies, builds project
- Downloads build artifacts from S3 (`bucket/generateDownloadUrl.ts`)
- Streams logs via WebSocket (`ws/socketManager.ts`)
- Configures Nginx and installs SSL certificates

### `src/repoActions/`
- `cloneBuildRepo.ts`: Clones repo, runs install/build commands, streams logs
- `getRepoName.ts`: Extracts repo name from URL
- `runRepo.ts`: Starts built repo on VPS, streams logs

### `src/SSHClient/SSHClient.ts`
SSH client abstraction for command execution, sequential runs, and log streaming.

### `src/bucket/`
- `generateDownloadUrl.ts`: Generates S3 pre-signed URLs for build artifact download
- `s3.ts`: S3 client setup

### `src/utils/`
- `decryptPassword.ts`: Decrypts encrypted VPS passwords
- `checkUrl.ts`: Validates repo URLs
- `generatedDeploymentId.ts`, `generateId.ts`: Generates unique deployment IDs
- `getCredentials.ts`: Fetches VPS credentials from DB
- `verifyMachine.ts`: Validates machine for WebSocket log streaming

### `src/ws/`
- `socketManager.ts`: Publishes logs to WebSocket clients
- `store.ts`: Stores server instance for WebSocket publishing

### `src/middlewares/checkAuth.ts`
JWT authentication middleware for API and WebSocket

### `src/jwt/verifyTokens.ts`
Verifies JWT tokens for authentication

### `src/db/pool.ts`
Database connection pool for credential and deployment data

### `src/types/types.ts`
Type definitions for status codes and shared types

---

## API Endpoints

### `POST /deploy`
Deploys a build to a specified VPS.
- **Body:**
  ```json
  {
    "vpsId": "string",
    "repoUrl": "string",
    "deploymentId": "string"
  }
  ```
- **Functionality:**
  - Authenticates user
  - Fetches VPS credentials
  - Connects via SSH
  - Clones repo, installs dependencies, builds project
  - Downloads build from S3
  - Configures Nginx, installs SSL
  - Streams logs via WebSocket (`deploymentId`)
  - Cleans up on failure

### `GET /`
Health check endpoint.

### `WS /deploy-logs`
WebSocket endpoint for real-time deployment logs.
- **Query:** `token`, `machineId`
- **On connect:**
  - Authenticates user and machine
  - Subscribes client to a unique `deploymentId`
  - Sends logs for that deployment

---

## Nginx & SSL Certificate Automation

- **Nginx Configuration:**
  After deployment, the service can update Nginx configs on the VPS to route traffic to the deployed app.
  - Example command:
    ```bash
    sudo cp /home/ubuntu/deployments/<buildId>/nginx.conf /etc/nginx/sites-available/<site>
    sudo ln -s /etc/nginx/sites-available/<site> /etc/nginx/sites-enabled/
    sudo systemctl reload nginx
    ```

- **SSL Certificate Installation:**
  Uses Certbot to install SSL certificates for the deployed domain.
  - Example command:
    ```bash
    sudo certbot --nginx -d yourdomain.com --non-interactive --agree-tos -m admin@yourdomain.com
    ```

---

## S3 File Download

- Generates a pre-signed S3 URL for build artifacts
- Downloads the file on the VPS using `curl`:
  ```bash
  curl -L "<presigned_url>" -o /home/ubuntu/deployments/<buildId>/app.zip
  ```

---

## Authentication

- Uses JWT tokens for API and WebSocket authentication
- Machine validation for secure log streaming

---

## Development

```bash
bun run dev
```
Open [http://localhost:3000/](http://localhost:3000/) in your browser.

---

## Environment Variables

Create a `.env` file with:
```
PORT=3000
ENCRYPTION_KEY=your_encryption_key
ENCRYPTION_ALGORITHM=AES
AWS_REGION=your-region
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_BUCKET_NAME=your-bucket
```

---

## Deployment

- Run the service on your server
- Point Nginx to the Bun app port
- Use Certbot for SSL

---

## License

MIT