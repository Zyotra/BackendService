# Core Service Logic & Internals

This document details the internal mechanisms of the DeploymentService, focusing on the "How" of automation.

## 1. Remote Execution Engine (`SSHClient`)

The foundation of the service is `src/SSHClient/SSHClient.ts`, which wraps the `ssh2` library.

### Architecture
- **Stateful Connection**: The class maintains an active connection state.
- **Stream Handling**: Commands are executed using `conn.exec()`.
- **Output Streaming**: Standard Output (stdout) and Standard Error (stderr) are merged and streamed back to the caller in real-time via the `onLog` callback. This enables the WebSocket live log feature.

### Key Methods
- **`runSequential(commands: string[], onLog)`**:
  - The critical orchestrator. It expects an array of shell command strings.
  - **Fail-Fast**: It iterates through commands. If ANY command returns a non-zero exit code, the chain stops immediately, and the Promise rejects (or returns false).
  - **Atomicity**: While not true transactional atomicity, this ensures we don't try to "start" a server that failed to "build".

## 2. Repository Actions (`src/repoActions`)

These are modular "scripts" that encapsulate complex deployment steps.

### A. The Cloning Strategy (`cloneRepo.ts`)
1.  **Cleanup**: Checks if directory exists. If so, assumes dirty state or redeploy (logic handles both).
2.  **Authentication**: Uses public HTTPS cloning.
    - *Limitation*: Currently supports public repos mostly, unless token is embedded in URL.
3.  **Command**: `git clone <url>`

### B. Environment Injection (`injectEnv.ts`)
- **Challenge**: Writing multiline secure secrets to a remote file without exposing them in process list or shell history.
- **Solution**: Uses `printf` with redirection.
  ```bash
  printf "KEY=VALUE\nOTHER=VALUE" > .env
  ```
- **Security**: This handles basic strings, but complex characters in values (like `$`, `` ` ``, `"`) need careful escaping to prevent shell interpretation.

### C. Nginx Configuration (`injectNginxConfig.ts`)
The system manages Reverse Proxying automatically.
1.  **Template Generation**: `src/templates/nginxConfig.ts` generates a configuration block.
    - Supports `proxy_pass http://127.0.0.1:<PORT>`
    - Sets `Upgrade` headers for WebSocket support.
2.  **Activation**:
    - Writes to `/etc/nginx/sites-available/<domain>`
    - Symlinks to `/etc/nginx/sites-enabled/<domain>`
    - Reloads Nginx (`systemctl reload nginx`)

### D. SSL Automation (`enableDomain.ts`)
Uses **Certbot**.
- **Command**: `certbot --nginx -d <domain> --non-interactive ...`
- **Implication**: The VPS *must* have port 80/443 open and DNS must be propagated pointing to the VPS IP, otherwise Certbot validation fails.

## 3. Deployment Controller Logic

The `deployWebServiceController` acts as a **Saga Orchestrator**:

1.  **Validation Phase**: Check Domain (DB), Check VPS (DB).
2.  **Preparation Phase**: Decrypt credentials, Connect SSH.
3.  **Execution Phase**:
    - `installDependencies`
    - `cloneRepo`
    - `injectEnv`
    - `buildRepo` (or Docker build)
    - `startWebService` (PM2 or Docker run)
    - `injectNginxConfig`
    - `enableDomain` (SSL)
4.  **Finalization Phase**: Update DB status to `SUCCESS`, disconnect SSH.
5.  **Failure Compensation**:
    - If any step fails (catch block), it logs `FAILED` activity.
    - Attempts `cleanDirectory` to remove the partial repo.
    - Does *not* currently rollback strict Nginx changes if SSL fails (potential improvement area).

## 4. Security Internals

### Credential Encryption
- **File**: `src/utils/decryptPassword.ts`
- **Algo**: AES (Advanced Encryption Standard) via `crypto-js`.
- **Key**: `process.env.ENCRYPTION_KEY`.
- **Flow**: User enters password -> Frontend Encrypts (or Backend) -> DB Stores Ciphertext -> Deployment Controller Decrypts -> Use in memory for SSH.

### Shell Injection Mitigation
The system constructs commands dynamically:
`cd ${dirName} && ${buildCommand}`

- **Risk**: If `dirName` or `buildCommand` contains `; rm -rf /`, it executes.
- **Current Defense**: Reliance on input validation (e.g., project names derived from Repo URLs).
- **Hardening**: Future improvements should whitelist characters for `dirName` and strictly sanitize user-provided commands.

