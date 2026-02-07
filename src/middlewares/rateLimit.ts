import Elysia from "elysia";

/**
 * Rate Limiting Configuration for Zyotra BackendService
 * 
 * Tiered rate limits based on endpoint resource intensity:
 * - HEAVY: Deploy operations (SSH, git clone, PM2, Certbot) - 5 req/3min
 * - AUTH: Login/Register/OTP - 15 req/3min  
 * - MODERATE: DB operations, restarts - 30 req/3min
 * - LIGHT: CRUD reads - 90 req/3min
 * - GLOBAL: Overall fallback - 100 req/3min
 */

// Time window in milliseconds (3 minutes)
const WINDOW_MS = 3 * 60 * 1000;

// Rate limit tiers (requests per 3 minutes)
const LIMITS = {
    HEAVY: 5,      // Deploy operations
    AUTH: 15,      // Authentication endpoints
    MODERATE: 20,  // Database queries, restarts
    LIGHT: 90,     // CRUD reads
    GLOBAL: 100    // Fallback limit
} as const;

// Endpoint categorization
const HEAVY_ENDPOINTS = [
    '/deploy-webservice',
    '/deploy-ui',
    '/deploy-postgres',
    '/deploy-mysql',
    '/deploy-redis'
];

const AUTH_ENDPOINTS = [
    '/login',
    '/register',
    '/send-otp'
];

const MODERATE_ENDPOINTS = [
    '/run-query',
    '/run-mysql-query',
    '/backup-postgres-db',
    '/backup-mysql-db',
    '/deploy-latest-commit',
    '/deploy-latest-ui-commit',
    '/start-postgres',
    '/stop-postgres',
    '/start-mysql',
    '/stop-mysql',
    '/start-redis',
    '/stop-redis',
    '/delete-project',
    '/delete-machine',
    '/delete-domain',
    '/delete-db',
    '/delete-mysql',
    '/delete-redis-server'
];

// In-memory store for rate limiting
// Structure: Map<identifier, Map<tier, { count: number, windowStart: number }>>
const rateLimitStore = new Map<string, Map<string, { count: number; windowStart: number }>>();

console.log("🟡 [RateLimit] Module loaded and initialized");

// Cleanup old entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, tiers] of rateLimitStore.entries()) {
        for (const [tier, data] of tiers.entries()) {
            if (now - data.windowStart > WINDOW_MS * 2) {
                tiers.delete(tier);
            }
        }
        if (tiers.size === 0) {
            rateLimitStore.delete(key);
        }
    }
}, 5 * 60 * 1000);

/**
 * Determine the rate limit tier for a given path
 */
function getTierForPath(path: string): keyof typeof LIMITS {
    // Check exact matches and prefix matches
    if (HEAVY_ENDPOINTS.some(ep => path === ep || path.startsWith(ep + '/'))) {
        return 'HEAVY';
    }
    if (AUTH_ENDPOINTS.some(ep => path === ep || path.startsWith(ep + '/'))) {
        return 'AUTH';
    }
    if (MODERATE_ENDPOINTS.some(ep => path === ep || path.startsWith(ep + '/'))) {
        return 'MODERATE';
    }
    // Read endpoints and others get LIGHT limit
    return 'LIGHT';
}

/**
 * Get client identifier (IP or userId if available)
 */
function getClientIdentifier(request: Request, userId?: string | number): string {
    if (userId) {
        return `user:${userId}`;
    }
    // Fallback to IP address
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
    return `ip:${ip}`;
}

/**
 * Check rate limit and return result
 */
function checkRateLimit(
    identifier: string,
    tier: keyof typeof LIMITS
): { allowed: boolean; remaining: number; resetIn: number } {
    const now = Date.now();
    const limit = LIMITS[tier];

    // Get or create user's tier map
    if (!rateLimitStore.has(identifier)) {
        rateLimitStore.set(identifier, new Map());
    }
    const userTiers = rateLimitStore.get(identifier)!;

    // Get or create tier data
    let tierData = userTiers.get(tier);
    if (!tierData || now - tierData.windowStart > WINDOW_MS) {
        tierData = { count: 0, windowStart: now };
        userTiers.set(tier, tierData);
        console.log(`[RateLimit] NEW WINDOW - Identifier: ${identifier}, Tier: ${tier}`);
    }

    // Also check global limit
    let globalData = userTiers.get('GLOBAL');
    if (!globalData || now - globalData.windowStart > WINDOW_MS) {
        globalData = { count: 0, windowStart: now };
        userTiers.set('GLOBAL', globalData);
        console.log(`[RateLimit] NEW GLOBAL WINDOW - Identifier: ${identifier}`);
    }

    console.log(`[RateLimit] CHECK BEFORE - Identifier: ${identifier}`);
    console.log(`  Tier: ${tier}, Current Count: ${tierData.count}, Limit: ${limit}`);
    console.log(`  Global Count: ${globalData.count}, Limit: ${LIMITS.GLOBAL}`);
    console.log(`  Time in window: ${now - tierData.windowStart}ms / ${WINDOW_MS}ms`);

    // Check if either limit is already exceeded
    if (tierData.count >= limit) {
        const tierReset = WINDOW_MS - (now - tierData.windowStart);
        console.log(`[RateLimit] ❌ BLOCKED - TIER LIMIT EXCEEDED (${tierData.count} >= ${limit})`);
        console.log(`  Reset in: ${Math.ceil(tierReset / 1000)}s`);
        return {
            allowed: false,
            remaining: 0,
            resetIn: tierReset
        };
    }

    if (globalData.count >= LIMITS.GLOBAL) {
        const globalReset = WINDOW_MS - (now - globalData.windowStart);
        console.log(`[RateLimit] ❌ BLOCKED - GLOBAL LIMIT EXCEEDED (${globalData.count} >= ${LIMITS.GLOBAL})`);
        console.log(`  Reset in: ${Math.ceil(globalReset / 1000)}s`);
        return {
            allowed: false,
            remaining: 0,
            resetIn: globalReset
        };
    }

    // Increment counters AFTER checking limits
    tierData.count++;
    globalData.count++;

    const tierRemaining = limit - tierData.count;
    const globalRemaining = LIMITS.GLOBAL - globalData.count;
    const remaining = Math.min(tierRemaining, globalRemaining);

    console.log(`[RateLimit] ✅ ALLOWED - Identifier: ${identifier}`);
    console.log(`  After increment - Tier: ${tierData.count}/${limit}, Remaining: ${tierRemaining}`);
    console.log(`  After increment - Global: ${globalData.count}/${LIMITS.GLOBAL}, Remaining: ${globalRemaining}`);

    return {
        allowed: true,
        remaining: remaining,
        resetIn: WINDOW_MS - (now - tierData.windowStart)
    };
}

/**
 * Rate limiting middleware for Elysia
 */
const rateLimitPlugin = new Elysia({ name: 'rate-limit' })
    .derive(({ request, set }) => {
        return {
            checkRateLimitForUser: (userId?: string | number) => {
                const path = new URL(request.url).pathname;
                const tier = getTierForPath(path);
                const identifier = getClientIdentifier(request, userId);
                const result = checkRateLimit(identifier, tier);

                // Set rate limit headers
                set.headers['X-RateLimit-Limit'] = String(LIMITS[tier]);
                set.headers['X-RateLimit-Remaining'] = String(result.remaining);
                set.headers['X-RateLimit-Reset'] = String(Math.ceil(result.resetIn / 1000));
                set.headers['X-RateLimit-Tier'] = tier;

                return result;
            }
        };
    });

/**
 * Pre-auth rate limiting (for public endpoints like /login, /register)
 * Uses IP-based identification
 */
const publicRateLimitPlugin = new Elysia({ name: 'public-rate-limit' })
    .onBeforeHandle(({ request, set }) => {
        const path = new URL(request.url).pathname;

        // Skip rate limiting for health check
        if (path === '/') return;

        const tier = getTierForPath(path);
        const identifier = getClientIdentifier(request);
        
        console.log(`\n${'='.repeat(80)}`);
        console.log(`[RateLimit Middleware] Public Request`);
        console.log(`  Path: ${path}`);
        console.log(`  Tier: ${tier}`);
        console.log(`  Identifier: ${identifier}`);
        console.log(`${'='.repeat(80)}`);
        
        const result = checkRateLimit(identifier, tier);

        // Set rate limit headers
        set.headers['X-RateLimit-Limit'] = String(LIMITS[tier]);
        set.headers['X-RateLimit-Remaining'] = String(result.remaining);
        set.headers['X-RateLimit-Reset'] = String(Math.ceil(result.resetIn / 1000));
        set.headers['X-RateLimit-Tier'] = tier;

        console.log(`[RateLimit Result] Allowed: ${result.allowed}, Remaining: ${result.remaining}`);

        if (!result.allowed) {
            console.log(`[RateLimit] 🚫 REJECTING REQUEST - Status 429`);
            set.status = 429;
            throw new Error(`Too many requests (${tier}). Please try again in ${Math.ceil(result.resetIn / 1000)}s`);
        }
        
        console.log(`[RateLimit] ✅ REQUEST ALLOWED TO PROCEED\n`);
    });

/**
 * Authenticated rate limiting (for protected endpoints)
 * Uses userId-based identification for more accurate per-user limits
 */

// Step 1: Create a separate Elysia instance like checkAuth
const authRateLimitCheck = new Elysia()
    .derive(({ request, set }: any) => {
        console.log(`\n🟡 [AuthRateLimit Derive] Called for path: ${new URL(request.url).pathname}`);
        return {
            rateLimitInfo: {
                request,
                set
            }
        };
    })
    .as("scoped");

// Step 2: Create the plugin like checkAuthPlugin
const authRateLimitPlugin = new Elysia()
    .use(authRateLimitCheck)
    .guard({
        beforeHandle: async ({ rateLimitInfo, userId }: any) => {
            if (!rateLimitInfo) {
                console.log(`[AuthRateLimit Guard] No rateLimitInfo available`);
                return;
            }
            
            const { request, set } = rateLimitInfo;
            const finalUserId = userId || 'anonymous';
            
            console.log(`\n${'='.repeat(80)}`);
            console.log(`[AuthRateLimit Guard] Checking rate limit`);
            console.log(`  Path: ${new URL(request.url).pathname}`);
            console.log(`  UserId: ${finalUserId}`);
            console.log(`${'='.repeat(80)}`);
            
            const path = new URL(request.url).pathname;
            const tier = getTierForPath(path);
            const identifier = userId ? `user:${userId}` : getClientIdentifier(request);
            
            const result = checkRateLimit(identifier, tier);
            
            // Set rate limit headers
            set.headers['X-RateLimit-Limit'] = String(LIMITS[tier]);
            set.headers['X-RateLimit-Remaining'] = String(result.remaining);
            set.headers['X-RateLimit-Reset'] = String(Math.ceil(result.resetIn / 1000));
            set.headers['X-RateLimit-Tier'] = tier;
            
            console.log(`[AuthRateLimit] Allowed: ${result.allowed}, Remaining: ${result.remaining}`);
            
            if (!result.allowed) {
                console.log(`[AuthRateLimit] 🚫 BLOCKING REQUEST - 429 Status`);
                set.status = 429;
                return {
                    status: 'error',
                    message: `Too many requests (${tier}). Please try again in ${Math.ceil(result.resetIn / 1000)}s`,
                    retryAfter: Math.ceil(result.resetIn / 1000)
                };
            }
            
            console.log(`[AuthRateLimit] ✅ ALLOWED\n`);
        }
    })
    .as("scoped");

export {
    rateLimitPlugin,
    publicRateLimitPlugin,
    authRateLimitPlugin,
    LIMITS,
    WINDOW_MS
};
