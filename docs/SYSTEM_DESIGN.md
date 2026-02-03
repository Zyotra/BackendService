# System Design Document - DeploymentService (Zyotra)

## 1. System Overview

### Purpose and Scope
The **DeploymentService** is a specialized backend automation platform designed to simplify the deployment of applications (Web Services, Static UIs) and databases to user-owned Virtual Private Servers (VPS). It acts as an orchestration layer between the user interface, source control (GitHub), and cloud infrastructure (VPS, S3).

**Key Capabilities:**
- Automated provisioning of VPS environments.
- Zero-downtime deployment of Web Services (Node.js, Bun, Python) and Static Sites.
- Managed Database Services (PostgreSQL, MySQL, Redis) on user infrastructure.
- Real-time build interaction and log streaming via WebSockets.
- Automatic SSL (Certbot) and Nginx Reverse Proxy configuration.

### High-Level Architecture
The system follows a **Service-Based Modular Monolith** architecture. While the codebase is a single repository (`src`), the logic is strictly organized into distinct functional domains (Auth, Deployment, UI, Storage) that could eventually be split into microservices.

**Technology Stack:**
- **Runtime**: [Bun](https://bun.sh/) (high-performance JavaScript runtime).
- **Framework**: [ElysiaJS](https://elysiajs.com/) (fast, type-safe web framework for Bun).
- **Language**: TypeScript.
- **Database**: PostgreSQL (System Data) accessed via [Drizzle ORM](https://orm.drizzle.team/).
- **Infrastructure Automation**: `ssh2` for remote command execution.
- **Artifact Storage**: AWS S3.
- **Process Management**: PM2 (on target VPS).

---

## 2. Architecture & Design

*For visual diagrams, please refer to [ARCHITECTURE_DIAGRAMS.md](./ARCHITECTURE_DIAGRAMS.md).*

### Architectural Pattern
The system implements a **Layered Architecture** within a monolithic deployment:
1.  **Presentation Layer**: REST API and WebSocket Endpoints (`src/controllers`).
2.  **Business Logic Layer**: Domain-specific controllers (`deployment-manager`, `auth-service`, etc.).
3.  **Data Access Layer**: Drizzle ORM schemas and Raw SQL queries (`src/db`).
4.  **Infrastructure Adapter Layer**: `SSHClient` and `RepoActions` that abstract the complexity of remote server management.

---

## 3. Data Flow

### Request/Response Flow (Standard API)
1.  **Request**: User sends HTTP request (e.g., `POST /deploy-webservice`).
2.  **Middleware**: `checkAuthPlugin` intercepts. It verifies the JWT from cookies using `src/jwt/verifyTokens.ts`. If invalid, returns 401. If valid, attaches `userId` to context.
3.  **Controller**: The route handler processes input.
    - Validates business rules (e.g., Domain availability via `checkDomainValidity`).
    - Decrypts sensitive infrastructure credentials (VPS password) using AES.
4.  **Action**: Controller orchestrates side-effects:
    - Connects to VPS via `SSHClient`.
    - Updates Database (deployments table).
    - Uploads/Downloads files from S3.
5.  **Response**: Returns JSON success/failure status and potentially a `deploymentId`.

### Real-time Log Streaming Flow (WebSocket)
1.  **Connection**: Client connects to `WS /deploy-logs?token=...&machineId=...`.
2.  **Handshake**: Server validates token and machine ownership.
3.  **Subscription**: Socket joins a "channel" identified by `deploymentId`.
4.  **Emission**: During deployment, `SSHClient` captures `stdout`/`stderr`.
5.  **Broadcast**: `socketManager.emitLog()` pushes these chunks to all subscribers of that `deploymentId`.

---

## 4. Database Design

The system uses **PostgreSQL** as the primary data store.

### Key Functional Entities
- **Users**: Core identity.
- **VPS_Machines**: Servers owned by users where applications are deployed. Stores IP, username, and *encrypted* password.
- **Deployments**: Tracks individual applications deployed on a VPS. Links `User` -> `Machine` -> `Repo`.
- **User_Domains**: Manages distinct web addresses and their binding to deployments.
- **Activity_Logs**: Audit trail of every action (deploy, delete, restart) performed by users.

### Schema Management
- **Drizzle ORM** (`drizzle-orm`) is used for schema definition (`src/db/schema.ts`) and migrations.
- **pg** (node-postgres) is used for connection pooling.

---

## 5. API Architecture

The API style is **RESTful** for control and **WebSocket** for observability.

### Endpoint Structure
Routes are grouped by feature in `src/index.ts` and `src/controllers`:
- `/auth/*`: Identity management.
- `/deploy-webservice`, `/deploy-ui`: Core deployment triggers.
- `/get-projects`, `/delete-project`: Resource management CRUD.
- `/storage-service/*`: Managed DB operations.

### Integration Points
- **GitHub**: Source code retrieval (via `git clone` on VPS).
- **AWS S3**: Storing build artifacts or user assets.
- **LetsEncrypt**: Automated certificate generation integration.

---

## 6. Component Details

*For a complete file-by-file inventory, see [COMPONENT_INVENTORY.md](./COMPONENT_INVENTORY.md).*

### Critical Components
1.  **SSHClient (`src/SSHClient`)**: The "hands" of the system. It abstracts `ssh2` complexity, enabling sequential command execution (`runSequential`) and ensuring operations fail fast on errors.
2.  **RepoActions (`src/repoActions`)**: A library of "Scripts" meant to be run remotely. Includes logic for:
    - Cloning repositories.
    - Injecting `.env` files safely.
    - Configuring Nginx templates.
    - Managing PM2 processes.
3.  **DeployController (`deployWebServiceController`)**: The "brain" of deployment. It coordinates the DB state, SSH actions, and File storage into a cohesive transaction.

---

## 7. Security Architecture

### Authentication
- **Mechanism**: JWT (JSON Web Tokens).
- **Transport**: Secure Cookies (`accessToken`).
- **Middleware**: Custom Elysia plugin `checkAuth` enforces login on protected routes.

### Authorization
- **Resource Ownership**: Users can only manage Machines and Deployments linked to their `userId`. Queries consistently use `WHERE ownerId = $1` clauses.

### Data Protection
- **Credentials**: VPS passwords are **never** stored in plain text. They are encrypted using AES (via `crypto-js`) before storage and decrypted only during active deployment sessions in memory.
- **Input Validation**: API inputs are checked, though security relied heavily on parameterization.
- **Injection Prevention**:
    - **SQL**: Protected via Drizzle ORM and Parameterized Queries.
    - **Shell**: The system constructs shell commands. This is a critical security focus area. Current implementation uses template literals; strict sanitization of inputs (like repo URLs and project names) is essential.

---

## 8. Scalability & Performance

### Performance
- **Bun Runtime**: Utilizes the speed of Bun for low-latency API responses.
- **Async/Non-blocking**: SSH operations and file I/O are non-blocking, allowing the single-threaded event loop to handle many concurrent users.

### Scalability Considerations
- **Stateless API**: The API layer is largely stateless (auth via tokens), allowing horizontal scaling behind a load balancer.
- **WebSocket Scaling**: Currently uses in-memory Pub/Sub (`src/ws/store.ts`). To scale to multiple backend instances, a Redis Pub/Sub layer would be needed to synchronize WebSocket messages across nodes.
- **Database**: Postgres can be scaled vertically or via read replicas. Connection pooling is implemented.

---

## 9. Troubleshooting & Common Issues

- **Deployment Failures**: usually occur due to SSH connectivity issues (check VPS firewall/credentials) or Build failures (check user code/scripts).
- **WebSocket Disconnects**: Often caused by aggressive timeouts or network interruptions. The client should implement reconnection logic.
- **Permission Errors**: If the backend cannot invoke `sudo` on VPS, deployments fail. The VPS user must have passwordless sudo or configured permissions.

