# API Reference

This document provides a detailed reference for the Zyotra DeploymentService API.

## Base URL
All endpoints are relative to the server root (e.g., `http://localhost:3000`).
The service runs on the port specified in `.env` (default `3000`).

## Authentication
Most endpoints require authentication via a **JSON Web Token (JWT)** stored in an HTTP-only cookie named `accessToken`.
- **Middleware**: `checkAuthPlugin` (`src/middlewares/checkAuth.ts`)
- **Flow**:
  1.  Middleware checks `cookie.accessToken`.
  2.  Verifies token signature.
  3.  Injects `userId` into the request context.
  4.  Returns `401 Unauthorized` if invalid.

---

## 1. Authentication Service
Endpoints for user identity management.

### POST `/login`
Authenticate a user and set session cookies.
- **Controller**: `src/controllers/auth-service/loginController.ts`
- **Auth**: Public
- **Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "yourpassword"
  }
  ```
- **Response** (200 OK):
  ```json
  {
    "message": "Login successful",
    "userId": 1,
    "accessToken": "eyJhb..."
  }
  ```
- **Cookies Set**:
  - `accessToken`: Short-lived JWT (15 min).
  - `refreshToken`: Long-lived JWT (15 days).

### POST `/register`
Create a new user account.
- **Controller**: `src/controllers/auth-service/registerController.ts`
- **Auth**: Public
- **Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "yourpassword",
    "name": "John Doe",
    "otp": "123456"
  }
  ```
- **Pre-requisite**: OTP must be verified (implied flow via `send-otp`).
- **Response** (200 OK): `{"message": "User registered successfully"}`

---

## 2. Deployment Endpoints

### POST `/deploy-webservice`
Deploy a backend service (Node, Python, Bun, Docker, etc.) to a VPS.
- **Controller**: `src/controllers/web-service/deployWebServiceController.ts`
- **Auth**: Protected
- **Body**:
  ```json
  {
    "vpsId": "uuid-string",
    "repoUrl": "https://github.com/user/repo.git",
    "deploymentId": "dep_12345",
    "domain": "api.example.com",
    "framework": "express",
    "packageInstallerCommand": "npm install",
    "buildCommand": "npm run build",
    "serverFilePath": "dist/index.js",
    "env": { "PORT": "3000", "DB_URL": "..." },
    "sourceDir": "backend" // Optional subfolder
  }
  ```
- **Behavior**:
  1.  Validates domain availability.
  2.  Connects to VPS via SSH.
  3.  Clones repo, installs deps, builds.
  4.  Configures Nginx reverse proxy & SSL (Certbot).
  5.  Starts process with PM2.
- **Response**:
  - 200 OK: `{"status": "success", "message": "Deployment finished", "dirName": "..."}`
  - 400 Bad Request: Validation errors.

### POST `/deploy-ui`
Deploy a static frontend application (React, Vue, Next.js static, etc.).
- **Controller**: `src/controllers/ui-service/deployUIController.ts`
- **Auth**: Protected
- **Body**:
  ```json
  {
    "vpsId": "uuid-string",
    "repoUrl": "https://github.com/user/frontend.git",
    "deploymentId": "dep_67890",
    "domain": "app.example.com",
    "framework": "react",
    "packageInstallerCommand": "npm install",
    "buildCommand": "npm run build",
    "outDir": "dist", // Directory containing static assets
    "env": { "VITE_API_URL": "..." }
  }
  ```
- **Behavior**: Same as webservice, but copies `outDir` to `/var/www` and configures Nginx to serve static files.

### GET `/deploy-latest-commit/:id`
Redeploy a specific project (pull latest changes & restart).
- **Controller**: `src/controllers/web-service/deployLatestCommitController.ts`
- **Params**: `id` (Deployment ID)

---

## 3. Resource Management

### GET `/get-projects`
List all deployments for the logged-in user.
- **Return**: Array of deployment objects.

### DELETE `/delete-project/:id`
Remove a deployment, delete files from VPS, and Clean Nginx config.

### Machine Management
- **POST `/add-machine`**: Register a new VPS.
- **GET `/get-machines`**: List user's machines.
- **DELETE `/delete-machine/:id`**: Remove a machine record.

---

## 4. Managed Storage Services (DBaaS)
Endpoints to provision databases on user VPS.

### POST `/deploy-postgres`
- **Controller**: `src/controllers/storage-service/Postgres/deploy-postgres.ts`
- **Body**: `{"vpsId": ..., "dbName": ..., "password": ...}`
- **Action**: Uses Docker or native install to spin up Postgres.

### POST `/run-query`
Execute a SQL query against a managed Postgres instance.
- **Body**: `{"query": "SELECT * FROM users", "dbId": ...}`

---

## 5. WebSocket APIs

### WS `/deploy-logs`
Stream real-time logs for an active deployment.
- **Connection**: `ws://host/deploy-logs?token=...&machineId=...`
- **Protocol**:
  - Server sends: `{"type": "DEPLOYMENT_ID", "deploymentId": "..."}`
  - Server sends: `{"type": "LOG", "log": "Installing dependencies..."}`

### WS `/live-logs`
Stream realtime application logs (from PM2).
- **Connection**: `ws://host/live-logs?token=...&machineId=...`

