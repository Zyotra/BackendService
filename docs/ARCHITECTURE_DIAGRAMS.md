# Architecture Diagrams

## 1. System Context Diagram
Shows the DeploymentService in its environment.

```mermaid
C4Context
    title System Context Diagram for DeploymentService

    Person(developer, "Developer", "User deployment applications")
    System(deployment_service, "Deployment Service", "Manages automated deployments, authentication, and VPS provisioning.")
    
    System_Ext(github, "GitHub", "Stores source code")
    System_Ext(vps_provider, "VPS Provider", "Hosts user applications (DigitalOcean, AWS, etc.)")
    System_Ext(aws_s3, "AWS S3", "Stores build artifacts")
    System_Ext(postgres_db, "Main Database", "Stores user data, deployment configs")

    Rel(developer, deployment_service, "Uses API / Dashboard", "HTTPS/WSS")
    Rel(deployment_service, github, "Clones repositories", "Git/HTTPS")
    Rel(deployment_service, vps_provider, "Provisions & Deploys", "SSH")
    Rel(deployment_service, aws_s3, "Uploads/Generates Link", "HTTPS")
    Rel(deployment_service, postgres_db, "Reads/Writes Data", "TCP/IP")
    
    Rel(vps_provider, aws_s3, "Downloads Artifacts", "HTTPS")
```

## 2. Container Diagram
High-level containers of the system.

```mermaid
C4Container
    title Container Diagram

    Person(user, "User", "Developer")

    Container_Boundary(zyotra, "Zyotra Platform") {
        Container(api_gateway, "API Service", "Bun, Elysia", "Handles REST API, Auth, WebSocket")
        Container(worker, "Deployment Orchestrator", "TypeScript", "Executes SSH commands, manages Repo Actions (Part of API Service currently)")
        ContainerDb(db, "Primary Database", "PostgreSQL", "Stores Users, Machines, Deployments")
    }

    System_Ext(vps, "User VPS", "Target Server (Ubuntu)")
    System_Ext(s3, "Object Storage", "AWS S3")

    Rel(user, api_gateway, "API Calls", "HTTPS/JSON")
    Rel(user, api_gateway, "Live Logs", "WebSocket")
    
    Rel(api_gateway, db, "Query/Persist", "Drizzle ORM")
    Rel(api_gateway, s3, "Store Artifacts", "AWS SDK")
    Rel(api_gateway, vps, "SSH Commands", "Node-SSH")
```

## 3. Component Diagram (Backend Service)
Detailed breakdown of the monolithic Backend Service.

```mermaid
classDiagram
    class Index {
        +Server server
        +start()
    }
    class AuthService {
        +login()
        +register()
        +verifyToken()
    }
    class DeploymentManager {
        +deployWebService()
        +manageMachines()
        +manageStorage()
    }
    class WebServiceController {
        +deploy()
        +logs()
    }
    class SSHClient {
        +connect()
        +exec()
        +runSequential()
    }
    class RepoActions {
        +cloneRepo()
        +injectEnv()
        +startPM2()
    }
    class DB {
        +users
        +deployments
    }

    Index --> AuthService : uses protected routes
    Index --> DeploymentManager : routes
    DeploymentManager --> WebServiceController : delegates
    WebServiceController --> SSHClient : executes commands
    WebServiceController --> RepoActions : orchestrates
    WebServiceController --> DB : persists state
```

## 4. Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    USERS ||--o{ VPS_MACHINES : owns
    USERS ||--o{ DEPLOYMENTS : owns
    USERS ||--o{ ACTIVITY_LOGS : generates

    VPS_MACHINES ||--o{ DEPLOYMENTS : hosts
    
    USERS {
        int id PK
        string email
        string password_hash
    }

    VPS_MACHINES {
        uuid id PK
        int ownerId FK
        string ip
        string username
        string encrypted_password
    }

    DEPLOYMENTS {
        string id PK
        int ownerId FK
        uuid machineId FK
        string repoUrl
        string domain
        string status
    }
    
    ACTIVITY_LOGS {
        int id PK
        int param ownerId FK
        string action
        timestamp created_at
    }
```

## 5. Sequence Diagram: Deployment Flow
Critical path for `deploy-webservice`.

```mermaid
sequenceDiagram
    participant User
    participant API as API Service
    participant DB
    participant SSH as SSH Client
    participant VPS as User VPS
    participant S3 as AWS S3

    User->>API: POST /deploy-webservice
    activate API
    API->>DB: Check Domain & Get VPS Creds
    DB-->>API: Creds (Encrypted)
    API->>API: Decrypt Password
    
    API->>SSH: Connect(IP, User, Pass)
    activate SSH
    SSH->>VPS: SSH Connection Est.
    
    API->>SSH: cloneRepo(RepoUrl)
    SSH->>VPS: git clone ...
    VPS-->>SSH: Stream Logs
    SSH-->>API: Log Stream
    API-->>User: WS: Log Message
    
    API->>SSH: Install & Build
    SSH->>VPS: npm install && npm run build
    
    alt Artifact Download Strategy
        API->>S3: Generate Signed URL
        API->>SSH: Download Artifact (curl)
        SSH->>VPS: Download Zip
    end
    
    API->>SSH: Start Service (PM2)
    SSH->>VPS: pm2 start ...
    
    API->>SSH: Config Nginx & Certbot
    SSH->>VPS: Write Config & Reload Nginx
    
    API->>DB: Update Deployment Status (SUCCESS)
    SSH->>API: Disconnect
    deactivate SSH
    
    API-->>User: 200 OK (DeploymentId)
    deactivate API
```

## 6. Logic Flow: Authentication

```mermaid
flowchart TD
    A[Client Request] --> B{Has Cookie?}
    B -- No --> C[401 Unauthorized]
    B -- Yes --> D[Extract Access Token]
    D --> E[Verify Token (JWT)]
    E -- Invalid --> C
    E -- Valid --> F[Attach userId to Context]
    F --> G[Execute Controller Logic]
```
