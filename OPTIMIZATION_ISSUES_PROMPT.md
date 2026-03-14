Create separate GitHub issues for each of the following optimization items found in the BackendService codebase audit. For each issue, use the title format: `[OPT-X] Short description`, apply labels `optimization` and the priority label (`P0`, `P1`, `P2`, or `P3`), and include the Problem, Location, Impact, and Fix (with code snippet) in the issue body.

---

### Issue 1: [P0] Fix broken ui-service/getDeploymentLogsController

**File:** `src/controllers/ui-service/getDeploymentLogsController.ts`

**Problem:** This controller has 3 compounding issues:
1. Never calls `decryptVpsPassword()` — sends encrypted ciphertext as SSH password
2. Never calls `ssh.connect()` — tries to exec on a non-connected client
3. No `ssh.close()` in a finally block — resource leak

The endpoint is 100% non-functional and always returns 500.

**Impact:** HIGH — endpoint completely broken

**Current broken code:**
```typescript
const ssh = new SSHClient({
    username: "root",
    host: vpsMachine[0].vps_ip,
    password: vpsMachine[0].vps_password // raw encrypted ciphertext!
})
const log = await ssh.exec(`cat $HOME/logs/ui-logs/${deploymentId}.log`) // no connect() called!
```

**Fix — replace the SSH setup and exec block with:**
```typescript
const hashedPassword = await decryptVpsPassword(vpsMachine[0].vps_password);
const ssh = new SSHClient({
    username: "root",
    host: vpsMachine[0].vps_ip,
    password: hashedPassword
});
await ssh.connect();
try {
    const log = await ssh.exec(`cat $HOME/logs/ui-logs/${deploymentId}.log`);
    set.status = StatusCode.OK;
    return { message: "success", log: log.output };
} finally {
    ssh.close();
}
```

Also add the missing import at the top:
```typescript
import decryptVpsPassword from "../../utils/decryptPassword";
```

---

### Issue 2: [P0] Encrypt database passwords before storing in deployed_db table

**Files:**
- `src/controllers/storage-service/Postgres/deploy-postgres.ts`
- `src/controllers/storage-service/MySQL/deployMySQL.ts`
- `src/controllers/storage-service/Redis/startNewRedis.ts`

**Problem:** Database credentials for deployed Postgres/MySQL/Redis instances are stored in plaintext in the `deployed_db` and `caching` tables. Any database compromise exposes all customer database passwords.

**Impact:** CRITICAL security issue

**Current code (deploy-postgres.ts):**
```typescript
await db.insert(deployed_db).values({
    dbName: dbName,
    host: vpsIp,
    username: userName,
    password: password, // plaintext!
    dbType: "postgres",
    vpsId: parseInt(vpsId),
    userId: userId,
    status: "running"
});
```

**Fix — encrypt before storage in all 3 files:**
```typescript
import encryptVpsPassword from "../../../crypto/encryptVpsPassword";

// In the insert:
await db.insert(deployed_db).values({
    dbName: dbName,
    host: vpsIp,
    username: userName,
    password: encryptVpsPassword(password), // encrypted
    dbType: "postgres",
    vpsId: parseInt(vpsId),
    userId: userId,
    status: "running"
});
```

Apply the same pattern in `deployMySQL.ts` and `startNewRedis.ts` (for the `caching` table insert). Also update any controllers that read these passwords back (e.g., `runQuery.ts`, `backupPostgres.ts`) to decrypt them before use.

---

### Issue 3: [P1] Parallelize checkDomainValidity + getCredentials in deploy controllers

**Files:**
- `src/controllers/web-service/deployWebServiceController.ts`
- `src/controllers/ui-service/deployUIController.ts`

**Problem:** `checkDomainValidity(domain)` and `getCredentials(vpsId)` are called sequentially but are completely independent DB queries.

**Impact:** ~10ms saved per deployment (one DB round trip)

**Current code:**
```typescript
const isDomainValid = await checkDomainValidity(domain);
if (!isDomainValid) { /* ... */ }
const credentials = await getCredentials(vpsId);
if (!credentials) { /* ... */ }
```

**Fix — run them in parallel:**
```typescript
const [isDomainValid, credentials] = await Promise.all([
    checkDomainValidity(domain),
    getCredentials(vpsId)
]);
if (!isDomainValid) {
    set.status = StatusCode.BAD_REQUEST;
    return { status: "error", message: "The provided domain is not available." };
}
if (!credentials) {
    set.status = StatusCode.NOT_FOUND;
    return { status: "error", message: "VPS not found" };
}
```

---

### Issue 4: [P1] Remove artificial 1s setTimeout in deployWebServiceController finally block

**File:** `src/controllers/web-service/deployWebServiceController.ts`

**Problem:** The finally block has a 1-second artificial delay before closing SSH:
```typescript
finally {
    if (ssh) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // unnecessary 1s delay
        ssh.close();
    }
}
```

The `saveLog` buffer already has its own flush mechanism via `flushDeploymentLogs()`.

**Impact:** 1 second added to every deployment response

**Fix — use flushDeploymentLogs instead:**
```typescript
import { flushDeploymentLogs } from "../../repoActions/saveLog";

// In the finally block:
finally {
    if (ssh) {
        try {
            await flushDeploymentLogs(deploymentId, ssh);
            console.log("[Deploy] Closing SSH connection...");
            ssh.close();
        } catch (error) {
            console.error("[Deploy] Error closing SSH:", error instanceof Error ? error.message : String(error));
        }
    }
}
```

---

### Issue 5: [P1] Combine nginx config injection into a single SSH command

**File:** `src/repoActions/injectNginxConfig.ts`

**Problem:** 5 sequential SSH round trips for nginx config injection:
```typescript
const commands = [
    `printf "${safeContent}" | sudo tee ${destinationPath} > /dev/null`,
    `sudo rm -f ${linkPath}`,
    `sudo ln -s ${destinationPath} ${linkPath}`,
    `sudo nginx -t`,
    `sudo systemctl reload nginx`
];
await ssh.runSequential(commands, ...);
```

**Impact:** ~250ms saved per deployment (4 saved SSH round trips)

**Fix — combine into single command:**
```typescript
const combinedCommand = `printf "${safeContent}" | sudo tee ${destinationPath} > /dev/null && sudo rm -f ${linkPath} && sudo ln -s ${destinationPath} ${linkPath} && sudo nginx -t && sudo systemctl reload nginx`;

await saveLog(deploymentId, `Injecting nginx config to ${destinationPath} and reloading nginx...`, ssh);
const result = await ssh.exec(combinedCommand, async (logChunk) => {
    console.log("SSH Log:", logChunk);
    await saveLog(deploymentId, logChunk, ssh);
    await socketManager.emitLog(deploymentId, logChunk);
});

if (result.exitCode !== 0) {
    throw new Error(`Nginx config injection failed: ${result.output}`);
}
```

---

### Issue 6: [P1] Combine sequential cleanDirectory calls into single SSH command

**Files:**
- `src/controllers/web-service/deployWebServiceController.ts`
- `src/controllers/ui-service/deployUIController.ts`

**Problem:** On failure paths, multiple `cleanDirectory()` calls run sequentially — each is a separate SSH `rm -rf` round trip:
```typescript
await cleanDirectory(ssh, getRepoName(repoUrl))
await cleanDirectory(ssh, `/etc/nginx/sites-available/${domain}`)
await cleanDirectory(ssh, `/etc/nginx/sites-enabled/${domain}`)
```

**Impact:** ~150ms saved per failure path (2 saved SSH round trips)

**Fix — single SSH command:**
```typescript
await ssh.exec(`rm -rf ${getRepoName(repoUrl)} /etc/nginx/sites-available/${domain} /etc/nginx/sites-enabled/${domain}`);
```

Apply this pattern everywhere multiple `cleanDirectory` calls appear in sequence in both deploy controllers.

---

### Issue 7: [P1] Fix SSH connection leaks in frontend deploy and MySQL table list controllers

**Files:**
- `src/controllers/ui-service/deployLatestCommitController.ts`
- `src/controllers/storage-service/MySQL/getMySQLTableList.ts`

**Problem:** Both controllers open SSH connections but have no `finally` block to close them. If any operation throws after `ssh.connect()`, the connection leaks.

**Impact:** Leaked SSH connections exhaust the VPS `MaxSessions` limit (default 10), causing subsequent operations to hang.

**Fix for deployLatestCommitController.ts — wrap in try/finally:**
```typescript
const ssh = new SSHClient({ host: vps_ip, password: hashedPassword, username: "root" });
await ssh.connect();
try {
    // ... existing deployment logic ...
    return { status: "success", message: "Frontend deployment initiated" };
} catch (error) {
    console.error("Error:", error);
    set.status = StatusCode.INTERNAL_SERVER_ERROR;
    return { status: "error", message: "Internal Server Error" };
} finally {
    ssh.close();
}
```

**Fix for getMySQLTableList.ts — add finally block:**
```typescript
} catch (error) {
    set.status = StatusCode.INTERNAL_SERVER_ERROR;
    return { message: error };
} finally {
    if (ssh) ssh.close();
}
```

---

### Issue 8: [P2] Stop returning passwords and secrets in list API responses

**Files:**
- `src/controllers/deployment-manager/Machines/getMachines.ts`
- `src/controllers/storage-service/Redis/getRedisServer.ts`
- `src/controllers/storage-service/Postgres/getdbController.ts`

**Problem:** List endpoints return all columns including encrypted `vps_password`, `ssh_key`, and plaintext DB `password` fields to the frontend.

**Impact:** Security risk + unnecessary payload inflation (~200-500 bytes per record)

**Fix for getMachines.ts — select only needed columns:**
```typescript
const machines = await db.select({
    id: vpsMachines.id,
    vps_ip: vpsMachines.vps_ip,
    vps_name: vpsMachines.vps_name,
    ram: vpsMachines.ram,
    storage: vpsMachines.storage,
    cpu_cores: vpsMachines.cpu_cores,
    expiryDate: vpsMachines.expiryDate,
    added_at: vpsMachines.added_at,
    updated_at: vpsMachines.updated_at,
}).from(vpsMachines).where(eq(vpsMachines.ownerId, userId));
```

**Fix for getRedisServer.ts — exclude password:**
```typescript
const redisServers = await db.select({
    id: caching.id,
    cacheName: caching.cacheName,
    host: caching.host,
    port: caching.port,
    vpsId: caching.vpsId,
    cachingType: caching.cachingType,
    status: caching.status,
    createdAt: caching.createdAt,
}).from(caching).where(eq(caching.userId, parseInt(userId)));
```

Apply the same pattern to Postgres and MySQL list endpoints.

---

### Issue 9: [P2] Use single DELETE with ownership check instead of SELECT then DELETE

**File:** `src/controllers/deployment-manager/Machines/deleteMachine.ts`

**Problem:** Two DB queries (SELECT to check existence + ownership, then DELETE) when a single DELETE with a WHERE clause suffices.

**Impact:** ~5ms saved per delete operation

**Current code:**
```typescript
const machineExists = await db.select().from(vpsMachines).where(eq(vpsMachines.id, parseInt(vps_Id)));
if (machineExists.length === 0) { /* not found */ }
if (machineExists[0].ownerId != userId) { /* unauthorized */ }
await db.delete(vpsMachines).where(eq(vpsMachines.id, parseInt(vps_Id)));
```

**Fix — single query:**
```typescript
const result = await db.delete(vpsMachines)
    .where(and(eq(vpsMachines.id, parseInt(vps_Id)), eq(vpsMachines.ownerId, userId)))
    .returning({ id: vpsMachines.id });

if (result.length === 0) {
    set.status = StatusCode.NOT_FOUND;
    return { status: "error", message: "Machine not found or unauthorized" };
}
set.status = StatusCode.OK;
return { status: "success", message: "Machine deleted successfully" };
```

Add `and` to the import: `import { eq, and } from "drizzle-orm";`

---

### Issue 10: [P2] Combine two sequential nginx log SSH reads into one

**File:** `src/controllers/web-service/getFrontendLiveLogsController.ts`

**Problem:** Two sequential SSH exec calls to read error and access logs:
```typescript
const errorLog = await ssh.exec(`cat /var/log/nginx/${repoName}_error.log`);
const accessLog = await ssh.exec(`cat /var/log/nginx/${repoName}_access.log`);
```

**Impact:** ~75ms saved per call (one SSH round trip)

**Fix — single SSH command with delimiter:**
```typescript
const result = await ssh.exec(
    `echo "===ERROR_LOG===" && cat /var/log/nginx/${repoName}_error.log 2>/dev/null || true && echo "===ACCESS_LOG===" && cat /var/log/nginx/${repoName}_access.log 2>/dev/null || true`
);
const parts = result.output.split("===ACCESS_LOG===");
const errorLog = (parts[0] || "").replace("===ERROR_LOG===", "").trim();
const accessLog = (parts[1] || "").trim();

return {
    message: "Frontend live logs fetched successfully",
    errorLog,
    accessLog
};
```

---

### Issue 11: [P2] Cache Redis path detection in RedisHelper

**File:** `src/HelperClasses/RedisHelper.ts`

**Problem:** `detectRedisPaths()` runs 3-4 SSH exec calls to find Redis binary locations. It's called in every method (`installRedisCLI`, `deleteRedisServer`, `startNewRedisServer`, `stopRedisSever`, `startExistingRedisServer`). When called in sequence (install then start), paths are detected twice.

**Impact:** ~200ms saved per Redis operation

**Fix — add caching flag:**
```typescript
class RedisHelper {
    private ssh: SSHClient;
    private redisServerPath: string = "redis-server";
    private redisCliPath: string = "redis-cli";
    private pathsDetected: boolean = false; // ADD THIS

    // ...

    private async detectRedisPaths(): Promise<void> {
        if (this.pathsDetected) return; // ADD THIS - skip if already detected

        // ... existing detection logic stays the same ...

        this.pathsDetected = true; // ADD THIS at end of method
    }
}
```

---

### Issue 12: [P2] Add gzip compression for API responses

**File:** `src/index.ts`

**Problem:** The backend API has no response compression. Large JSON responses like project lists, activity logs, and table data are sent uncompressed.

**Impact:** 3-10x payload reduction for list endpoints

**Fix — add compression after CORS setup:**
```typescript
app.use(cors({ /* ... */ }))

// Add response compression
app.onAfterHandle(({ set, request }) => {
    const accept = request.headers.get('accept-encoding') || '';
    if (accept.includes('gzip')) {
        set.headers['Content-Encoding'] = 'gzip';
        set.headers['Vary'] = 'Accept-Encoding';
    }
});
```

Alternatively, install `@elysiajs/compress` if available:
```typescript
import { compress } from '@elysiajs/compress';
app.use(compress());
```

---

### Issue 13: [P2] Use Bun.password.hash instead of bcryptjs for password hashing

**File:** `src/auth-modules/hashPassword.ts`

**Problem:** Using `bcryptjs` (pure JavaScript implementation) on Bun runtime. Bun has native `Bun.password.hash()` which is 3-5x faster.

**Impact:** 3-5x faster registration and password verification

**Current code:**
```typescript
import bcrypt from "bcryptjs";
const hashPassword = async (password: string): Promise<string> => {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    return hashedPassword;
}
export default hashPassword;
```

**Fix:**
```typescript
const hashPassword = async (password: string): Promise<string> => {
    return await Bun.password.hash(password, { algorithm: "bcrypt", cost: 10 });
};
export default hashPassword;
```

Also update `loginController.ts` to use `Bun.password.verify`:
```typescript
// Replace: const isPasswordValid = await bcrypt.compare(password, user[0].password);
const isPasswordValid = await Bun.password.verify(password, user[0].password);
```

And remove the `bcryptjs` import from `loginController.ts`. Both are bcrypt-compatible, so existing hashed passwords will still work.

---

### Issue 14: [P3] Move nodemailer transport debug logs inside initialization guard

**File:** `src/auth-modules/mail/sendEmail.ts`

**Problem:** `getTransporter()` logs SMTP config on every call, even when the transporter already exists:
```typescript
function getTransporter(): Transporter {
    console.log("Creating email transporter...");  // runs EVERY time
    console.log("SMTP_HOST:", process.env.SMTP_HOST);
    console.log("SMTP_PORT:", process.env.SMTP_PORT);
    // ...
    if (!transporter) { /* create */ }
    return transporter;
}
```

**Fix:**
```typescript
function getTransporter(): Transporter {
    if (!transporter) {
        console.log("Creating email transporter...");
        console.log("SMTP_HOST:", process.env.SMTP_HOST);
        console.log("SMTP_PORT:", process.env.SMTP_PORT);
        console.log("SMTP_USER:", process.env.SMTP_USER ? "defined" : "undefined");
        transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 587,
            secure: false,
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });
    }
    return transporter;
}
```

---

### Issue 15: [P3] Parallelize email send and OTP database insert

**File:** `src/auth-modules/mail/sendEmail.ts`

**Problem:** OTP email is sent first, then OTP is stored in DB sequentially. These are independent operations.

**Impact:** ~5ms saved per OTP request

**Current code:**
```typescript
const otp = generateOtp();
await emailTransporter.sendMail({ to, from, subject: "...", html: await generateOtpEmailContent(otp) });
await db.insert(otps).values({ email: to, otp: otp });
```

**Fix:**
```typescript
const otp = generateOtp();
const htmlContent = await generateOtpEmailContent(otp);
await Promise.all([
    emailTransporter.sendMail({ to, from, subject: "Zyotra Verification Email", html: htmlContent }),
    db.insert(otps).values({ email: to, otp: otp })
]);
```

---

### Issue 16: [P3] Clean up saveLog timers when deployment finishes

**File:** `src/repoActions/saveLog.ts`

**Problem:** `flushTimers` Map stores `setTimeout` references that are never cleaned up when a deployment finishes or SSH connection closes. The timer fires later on a closed SSH connection, causing silent errors.

**Fix — add a cleanup function and export it:**
```typescript
export function clearDeploymentBuffers(deploymentId: string) {
    const timer = flushTimers.get(deploymentId);
    if (timer) clearTimeout(timer);
    flushTimers.delete(deploymentId);
    logBuffer.delete(deploymentId);
}
```

Then call `clearDeploymentBuffers(deploymentId)` in the `finally` blocks of deploy controllers after `flushDeploymentLogs()`.

---

### Issue 17: [P3] Use unique constraint + catch for domain insert race condition

**File:** `src/controllers/deployment-manager/Domains/addNewDomain.ts`

**Problem:** SELECT-then-INSERT pattern has a race condition — between the two queries, another request could insert the same domain.

**Current code:**
```typescript
const isDomainExists = await db.select().from(userDomains).where(eq(userDomains.domain_address, req.domainAddress));
if (isDomainExists.length > 0) {
    return { status: "error", message: "Domain already exists" };
}
const newDomain = await db.insert(userDomains).values({ /* ... */ }).returning();
```

**Fix — use try/catch on unique violation (also add a unique index on domain_address in schema):**

In `src/db/schema.ts`, add unique constraint:
```typescript
export const userDomains = pgTable("user_domains", {
    id: serial("id").primaryKey(),
    domain_address: varchar("domain_address", { length: 255 }).notNull().unique(), // ADD .unique()
    // ... rest unchanged
});
```

In `addNewDomain.ts`:
```typescript
try {
    const newDomain = await db.insert(userDomains).values({
        domain_address: req.domainAddress,
        vps_ip: req.vpsIp,
        ownerId: userId
    }).returning();
    set.status = StatusCode.OK;
    return { status: "success", data: newDomain };
} catch (error: any) {
    if (error?.code === '23505') {
        set.status = StatusCode.BAD_REQUEST;
        return { status: "error", message: "Domain already exists" };
    }
    throw error;
}
```

---

### Issue 18: [P3] Cache domain.replace result for Docker container names

**Files:**
- `src/controllers/web-service/deployWebServiceController.ts`
- `src/controllers/web-service/deployLatestCommitController.ts`

**Problem:** `domain.replace(/\./g, '_')` is called 6+ times per Docker deployment. Should be computed once.

**Fix — extract to variables at the start of the Docker block:**
```typescript
const safeDomainName = domain.replace(/\./g, '_');
const containerName = `${safeDomainName}_container`;
const imageName = `${safeDomainName}_image`;

// Then use containerName and imageName throughout instead of repeated .replace() calls
const dockerRunCommands = [
    `cd ${dirName} && docker build -t ${imageName} .`,
    `docker run -d -p ${env["PORT"]}:${env["CONTAINER_PORT"]} --env-file ${dirName}/.env --name ${containerName} ${imageName}`
];
```

---

### Issue 19: [P3] Remove console.log statements from auth middleware

**File:** `src/middlewares/checkAuth.ts`

**Problem:** Three `console.log` calls execute on every authenticated request, logging token values and user data:
```typescript
console.log("Verifying token:", token);        // logs the actual token!
console.log("Token verification result:", isValid);
console.log("Authenticated user:", isValid);
```

**Impact:** ~1ms/request overhead + security risk (token in logs)

**Fix — remove all three console.log lines:**
```typescript
const checkAuth = new Elysia().derive(async ({ headers, set, cookie }: Context) => {
    const token = cookie.accessToken.value as string;
    if (!token) {
        set.status = StatusCode.EXPIRED_TOKEN;
        return { message: "Access Token Missing" };
    }
    const isValid = await verifyAccessToken(token);
    if (!isValid) {
        set.status = StatusCode.EXPIRED_TOKEN;
        return { message: "Invalid Access Token" };
    }
    return { userId: isValid.userId };
}).as("scoped");
```
