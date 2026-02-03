# Codebase Documentation - DeploymentService (Zyotra)

This document contains a per-file analysis of the codebase: routes, functions, commands executed, security notes, and data flow. Files are grouped by folder.

**Note:** File references are workspace-relative links.

---

## Root

### [src/index.ts](src/index.ts)
- Role: Application entrypoint; configures Elysia server, CORS, REST routes, and WebSocket `/deploy-logs`.
- Routes:
  - `GET /` — Health check. Public. Returns status and ISO timestamp. Responds 200 on success.
  - `WS /deploy-logs` — Opens WebSocket. Query params required: `token`, `machineId`. Workflow:
    - Verifies access token via `verifyAccessToken(token)`.
    - Checks machine ownership via `verifyMachine(machineId, userId)`.
    - Generates `deploymentId` and subscribes the ws connection to it using `ws.subscribe(deploymentId)`.
    - Sends initial message: `{ type: "DEPLOYMENT_ID", deploymentId }`.
    - Closes socket with code 1008 for invalid input/authorization, 1011 on errors.
  - Protected endpoints (plugin `checkAuthPlugin`):
    - `POST /deploy-webservice` — Triggers `deployWebServiceController`.
    - `GET /get-projects` — `getProjectsController`.
    - `DELETE /delete-project/:id` — `deleteProjectsController`.
    - `GET /get-activity-logs` — `getActivityLogsController`.

---

## Websockets

### [src/ws/store.ts](src/ws/store.ts)
- Exposes a `serverStore` object to store the running Bun `Server` instance so other modules (e.g., `socketManager`) can publish messages.

### [src/ws/socketManager.ts](src/ws/socketManager.ts)
- Function: `emitLog(deploymentId: string, log: string)` — publishes a JSON `{ type: 'LOG', log }` to `server.publish(deploymentId, message)`.
- Behavior: Logs how many bytes were sent and warns if 0 subscribers received the message.

---

## DB (src/db)

Files: `client.ts`, `pool.ts`, `schema.ts`, `saveActivity.ts`, `checkDomainValidity.ts`, `unlinkDomain.ts`

### [src/db/client.ts](src/db/client.ts)
- Exports `db` using `drizzle-orm` backed by `postgres` client started with `process.env.DEPLOY_DATABASE_URL`.

### [src/db/pool.ts](src/db/pool.ts)
- Exports `pg` `Pool` created with `process.env.DATABASE_URL`. Used for raw queries (user_domains, vps_machines, etc.).

### [src/db/schema.ts](src/db/schema.ts)
- Drizzle ORM table definitions for `deployments` and `activity_logs` with primary keys, timestamps and columns used by controllers.

### [src/db/saveActivity.ts](src/db/saveActivity.ts)
- Signature: `saveActivity(userId:number, deploymentId:string, vpsIp:string, domain:string, status:DeploymentStatus, repoUrl:string, log: string, framework:string)`.
- Purpose: Create a transaction inserting a record into `deployments` and `activity_logs`. If status is `SUCCESS`, it sets `user_domains.is_deployed = 1` using `pool.query`.
- DB ops: `tx.insert(deployments).values(...)`, `tx.insert(activityLogs).values(...)`, then optional `UPDATE user_domains SET is_deployed = $1 WHERE domain_address = $2`.
- Error Handling: catches exceptions, logs and returns `false`.

### [src/db/checkDomainValidity.ts](src/db/checkDomainValidity.ts)
- Signature: `checkDomainValidity(domain: string): Promise<boolean>`
- Purpose: Verifies that `user_domains` has an entry with `domain_address = $1` and `is_deployed = 0` (available to deploy). Uses parameterized query via `pool.query`.

### [src/db/unlinkDomain.ts](src/db/unlinkDomain.ts)
- Signature: `unLinkDomain(domain: string): Promise<boolean>` — sets `is_deployed = 0` for a domain using `UPDATE` with parameterized args.

Security note (DB): Parameterized queries via `pg` and use of `drizzle-orm` minimize SQL injection risk. Keep raw queries parameterized (they are $1, $2 style).

---

## Controllers (src/controllers)

Common context: Elysia `Context` objects provide `set`, `userId`, `body`, `params`.

### [src/controllers/deployWebServiceController.ts](src/controllers/deployWebServiceController.ts)
- Route: `POST /deploy-webservice` (protected via `checkAuthPlugin`).
- Body schema (expected):
  - `vpsId: string` (required)
  - `repoUrl: string` (required)
  - `deploymentId: string` (required)
  - `packageInstallerCommand: string` (required) e.g., `npm install` or `pnpm i`
  - `buildCommand?: string` (optional) e.g., `npm run build`
  - `serverFilePath?: string` (entry for pm2)
  - `env?: Record<string,string>` (optional env vars)
  - `domain: string` (required)
  - `framework: string` (required)

- High-level flow:
  1. Validate required fields; return 400 if missing.
  2. Check `checkDomainValidity(domain)` — ensure domain is available.
  3. Fetch VPS credentials via `getCredentials(vpsId)`.
  4. Decrypt VPS password using `decryptPassword` and connect over SSH using `SSHClient`.
  5. Clone repo using `cloneRepo(ssh, repoUrl, deploymentId)` which runs `git clone...
  6. Inject .env via `injectEnv` if env provided (writes `.env` in repo dir using `printf`).
  7. Build repo via `cloneBuildRepo` (runs package installer, optional build command).
  8. Start service via `startWebService` which runs `pm2 start ...` (or bun-based start if framework).
  9. Determine port using `getPort(env)` and generate Nginx config via templates; inject with `injectNginxConfig` (creates sites-available file and symlink to sites-enabled, reloads nginx).
  10. Enable SSL using `enableDomain` (installs certbot and runs certbot --nginx).
  11. Save activity via `saveActivity` with final status SUCCESS/FAILED.

- Commands executed over SSH (examples): `git clone <repoUrl>`, `${packageInstallerCommand}`, `${buildCommand}`, `pm2 start <entry> --name <dirName>`, `printf "..." > .env`, `sudo ln -s ...`, `sudo nginx -t && sudo nginx -s reload`, `sudo certbot --nginx -d ${domain} --non-interactive --agree-tos --register-unsafely-without-email --redirect`.

- Failure handling: Each stage returns early on failure, calls `saveActivity(..., 'FAILED', ...)`, attempts cleanup via `cleanDirectory(ssh, dirName)` and `pm2 delete <dirName>` where appropriate.

- Security considerations: Inputs are validated for presence but not deeply sanitized (e.g., domain). Commands interpolate values into shell strings — potential shell injection risk. Use stricter validation or create files via SFTP instead of printf where possible.

### [src/controllers/getProjectsController.ts](src/controllers/getProjectsController.ts)
- Route: `GET /get-projects` — returns list of `deployments` for `userId` (drizzle-orm select).

### [src/controllers/getActivityLogsController.ts](src/controllers/getActivityLogsController.ts)
- Route: `GET /get-activity-logs` — returns `activity_logs` for `userId`.

### [src/controllers/deleteProjectsController.ts](src/controllers/deleteProjectsController.ts)
- Route: `DELETE /delete-project/:id` — deletes a deployment owned by the user.
- Flow:
  - Verify `params.id` exists.
  - Query `deployments` verifying ownership (`ownerId === userId`).
  - Lookup machine via `getMachineDetail(vps_ip, userId)`.
  - Connect via SSH and run deletion commands depending on `projectType`:
    - Webservice: `rm -rf <dir>`, `sudo rm -f /etc/nginx/sites-enabled/<domain>`, `sudo rm -f /etc/nginx/sites-available/<domain>`, `pm2 delete <dir> || true`, `sudo nginx -t && sudo nginx -s reload`.
    - UI: similar, removing static files under `/var/www/<dir>`.
  - Insert activity log and delete DB record, then call `unLinkDomain(domain)`.

---

## Repo Actions (src/repoActions)

These utilities orchestrate commands executed remotely over SSH and log to a file and WebSocket using `socketManager`.

Files: `cloneRepo.ts`, `cloneBuildRepo.ts`, `injectEnv.ts`, `getRepoName.ts`, `enableDomain.ts`, `cleanDirectory.ts`, `getPort.ts`, `injectNginxConfig.ts`, `startWebService.ts`, `saveLog.ts`

Key functions summarized:

- `cloneRepo(ssh: SSHClient, repoUrl: string, deploymentId: string): Promise<boolean>`
  - Runs `git clone ${repoUrl}` via `ssh.runSequential`.
  - Calls `saveLog` and emits logs via `socketManager.emitLog`.

- `cloneBuildRepo` / `buildRepo(ssh, repoUrl, deploymentId, packageInstallerCommand, buildCommand)`
  - Runs `cd <dir> && <packageInstallerCommand>` and optional `cd <dir> && <buildCommand>`.

- `injectEnv(ssh, env, repoDirectoryName, deploymentId)`
  - Creates `.env` using `printf "<content>" > .env` inside repo directory.
  - Escapes `"`, `\` and uses `printf` so newlines persist.
  - Returns false if command exit code !== 0.

- `injectNginxConfig(ssh, nginxConfig, domain, deploymentId)`
  - Writes config to `/etc/nginx/sites-available/${domain}` using `printf` piped to `sudo tee`.
  - Removes existing symlink, symlinks the new file to `sites-enabled`, runs `sudo nginx -t` and reloads nginx.

- `enableDomain(ssh, domain, deploymentId)`
  - Installs `certbot` and runs `sudo certbot --nginx -d ${domain} --non-interactive --agree-tos --register-unsafely-without-email --redirect` to enable SSL.

- `startWebService(ssh, repoDirectoryName, serverFilePath, deploymentId, projectType?)`
  - For most projects runs `cd <dir> && pm2 start <serverFilePath> --name <dir>`.
  - For Bun/Elysia projects runs `cd <dir> && pm2 start bun --name <dir> -- run dist/index.js`.

- `saveLog(deploymentId, log)` (src/repoActions/saveLog.ts)
  - Writes a timestamped log line to a file at `BASE_DIR/<deploymentId>.log` (creates directory/file if missing) using `fs` synchronous methods.

Command security notes (repoActions):
- Many SSH commands are constructed with template strings including user-provided values (`domain`, `repoUrl`, `dirName`). This creates a risk of shell injection if inputs are not strictly validated. Prefer safer mechanisms such as uploading files with SFTP, using sanitized filenames, or passing arguments through shell-safe escaping.

---

## Utils

### [src/utils/getCredentials.ts](src/utils/getCredentials.ts)
- Gets VPS machine record from `vps_machines` by `id` using parameterized `pool.query`.

### [src/utils/decryptPassword.ts](src/utils/decryptPassword.ts)
- Decrypts AES-encrypted password using `crypto-js` with `process.env.ENCRYPTION_KEY`.

### [src/utils/verifyMachine.ts](src/utils/verifyMachine.ts)
- Verifies ownership of a machine using `pool.query('SELECT * FROM vps_machines WHERE id=$1 AND "ownerId"=$2', [machineId,userId])`.

### [src/utils/getMachineDetail.ts](src/utils/getMachineDetail.ts)
- Fetches a VPS machine row by `vps_ip` using parameterized query.

### [src/utils/generatedDeploymentId.ts](src/utils/generatedDeploymentId.ts)
- Generates a `dep_` prefixed random alphanumeric ID of length 16.

### [src/utils/generateId.ts](src/utils/generateId.ts)
- Generates 8-character random alphanumeric id.

### [src/utils/checkUrl.ts](src/utils/checkUrl.ts)
- Uses `simple-git` to `listRemote([repoUrl])` to confirm remote exists.

---

## SSHClient (src/SSHClient/SSHClient.ts)

- Class: `SSHClient` wraps `ssh2.Client`.
- Key methods:
  - `connect(): Promise<void>` — resolves on `ready` event, rejects on `error`.
  - `exec(command: string, onLog?: (chunk:string)=>void): Promise<CommandResult>` — executes a single command, collects `stdout` and `stderr`, calls `onLog` for chunks and resolves with `{command, output, exitCode}` when `stream` closes.
  - `runSequential(commands: string[], onLog?: (chunk:string)=>void): Promise<CommandResult[]>` — runs commands sequentially via `exec` and throws an Error if a command returns a non-zero exit code. Also calls `onLog` with a failure message before stopping.
  - `close()` — ends SSH connection.

Security and reliability notes:
- `runSequential` throws on non-zero exit codes which ensures early stop on failures.
- `exec` pipes both stdout and stderr to the same `onLog` callback — logs may include errors and should be distinguished when storing to logs.

---

## Bucket (src/bucket)

### [src/bucket/s3.ts](src/bucket/s3.ts)
- Exports an AWS S3 client configured with `S3_REGION`, `S3_ENDPOINT`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY`.

### [src/bucket/generateDownloadUrl.ts](src/bucket/generateDownloadUrl.ts)
- Uses `GetObjectCommand` and `getSignedUrl` to produce a signed URL that expires in 300 seconds.

---

## JWT (src/jwt/verifyTokens.ts)

- Exports `verifyAccessToken(token)` — verifies with `jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)` and returns `{userId}` on success or `false` on failure.

Security note: Token verification relies on a strong `ACCESS_TOKEN_SECRET` environment variable.

---

## Middleware (src/middlewares/checkAuth.ts)

- Builds an Elysia scoped plugin that extracts token from `cookie.accessToken.value`, calls `verifyAccessToken`, and provides `userId` in context. Protected routes are guarded to ensure `userId` exists.

Vulnerability note: If cookies are not set as `HttpOnly` and `Secure` on client side, token may be leaked. Ensure HTTPS and proper cookie flags.

---

## Types

- [src/types/types.ts](src/types/types.ts) — Type definitions for routes, `StatusCode` enum, `User` and `DeploymentStatus`.

---

## Commands Deep-Dive (common commands used across repo)

1. git clone <repoUrl>
   - Breakdown: `git` (VCS CLI) `clone` copies a remote repository locally.
   - Why: Pull application source to the VPS.
   - Expected: Creation of a directory named after repo and .git history. Failure if URL invalid or network/auth problem.

2. cd <dir> && <installer>
   - Example: `cd myapp && npm install`
   - Breakdown: `cd` changes directory; `&&` runs next command only if previous succeeded.
   - Why: Install dependencies inside project directory.
   - Failure: missing directory, npm missing, package.json errors.

3. cd <dir> && <buildCommand>
   - E.g., `npm run build` compiles assets.

4. pm2 start <entry> --name <name>
   - `pm2` is a process manager. `start` launches the process. `--name` gives an identifier used later for `pm2 delete`.

5. printf "<content>" > /path/file
   - Writes content to a file. Risk: content that includes unescaped `"` or `$` can break quoting; code escapes these characters.

6. sudo ln -s <src> <dst> / sudo rm -f <file>
   - Manage nginx site symlinks.

7. sudo nginx -t && sudo systemctl reload nginx
   - `nginx -t` tests configuration; `systemctl reload nginx` reloads if test passes.

8. sudo certbot --nginx -d <domain> --non-interactive --agree-tos --register-unsafely-without-email --redirect
   - Installs (or renews) TLS certs and configures nginx to use them non-interactively.

Failure scenarios for these commands include: missing binaries on VPS, permission errors, invalid domain DNS configuration for certbot, malformed config causing nginx test to fail.

---

## Security Analysis (global)

- Input validation: Controllers check presence of required fields but often interpolate user values into shell commands. This introduces shell-injection risk. Recommendation: validate `domain` (allowlist characters), sanitize file names and avoid direct shell interpolation; prefer SFTP for file writes.
- SQL injection: Raw queries use parameterized placeholders (`$1,$2`), and ORM (`drizzle-orm`) is used for structured queries — low risk if always parameterized.
- Authentication/Authorization: Token-based via `verifyAccessToken` and `checkAuth` middleware that reads cookies. Ensure tokens are signed with secure `ACCESS_TOKEN_SECRET` and cookies are `HttpOnly` + `Secure`.
- Credentials handling: VPS passwords are stored encrypted and decrypted with `ENCRYPTION_KEY`. Ensure strong key management and rotate keys. Avoid logging raw decrypted values; some files log credentials — mitigate logs containing secrets.
- Rate limiting: Not implemented. Consider adding per-user rate limiting on deploy endpoints to prevent abuse.
- Data encryption: AES via `crypto-js` used for decrypting stored secrets.

---

## Data Flow (example: Deploy flow)

- Client -> POST `/deploy-webservice` (cookie access token, JSON body)
- `checkAuthPlugin` validates token and sets `userId` on context.
- `deployWebServiceController`:
  - Validates body
  - Checks domain with `checkDomainValidity` (db)
  - Fetches VPS credentials `getCredentials` (pool)
  - Decrypts password `decryptPassword`
  - Connects `SSHClient.connect()`
  - Clone -> build -> env inject -> start service (SSH commands via `SSHClient.exec/runSequential`), writing logs with `saveLog` and `socketManager.emitLog`.
  - Inject nginx config and enable domain via certbot
  - Save records via `saveActivity` (drizzle-ORM + pool update)

Validation occurs in multiple places: controller validates presence, `checkDomainValidity` validates domain availability, `getPort` validates `PORT` is numeric. Errors are caught in controllers and logged.

---

If you want, I can:
- Generate API request/response JSON schemas for each endpoint.
- Produce a sequence diagram for the deploy flow.
- Harden commands to prevent shell injection (e.g., change file writing to SFTP and sanitize inputs).
