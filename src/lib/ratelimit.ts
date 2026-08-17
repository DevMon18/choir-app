import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Determine if Upstash credentials are available in environment
const hasUpstashEnv =
  Boolean(process.env.UPSTASH_REDIS_REST_URL) &&
  Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);

let redis: Redis | null = null;

if (hasUpstashEnv) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

// ──────────────────────────────────────────────
// IN-MEMORY SLIDING WINDOW FALLBACK (for Dev/Offline/Timeout)
// ──────────────────────────────────────────────
interface MemoryRecord {
  timestamps: number[];
}

class MemoryRateLimiter {
  private cache = new Map<string, MemoryRecord>();

  async check(
    identifier: string,
    maxRequests: number,
    windowMs: number
  ): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
    const now = Date.now();
    const windowStart = now - windowMs;

    let record = this.cache.get(identifier);
    if (!record) {
      record = { timestamps: [] };
      this.cache.set(identifier, record);
    }

    // Filter out timestamps outside current sliding window
    record.timestamps = record.timestamps.filter((t) => t > windowStart);

    if (record.timestamps.length >= maxRequests) {
      const oldestInWindow = record.timestamps[0] || now;
      return {
        success: false,
        limit: maxRequests,
        remaining: 0,
        reset: oldestInWindow + windowMs,
      };
    }

    record.timestamps.push(now);
    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests - record.timestamps.length,
      reset: now + windowMs,
    };
  }
}

const memoryLimiter = new MemoryRateLimiter();

function withTimeout<T>(promise: Promise<T>, ms: number = 350): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('RateLimit timeout')), ms)),
  ]);
}

// ──────────────────────────────────────────────
// UPSTASH RATELIMIT INSTANCES
// ──────────────────────────────────────────────
const authRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, '1 m'),
      analytics: true,
      prefix: '@ratelimit/auth',
    })
  : null;

const uploadRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(15, '1 m'),
      analytics: true,
      prefix: '@ratelimit/upload',
    })
  : null;

const mutationRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, '1 m'),
      analytics: true,
      prefix: '@ratelimit/mutation',
    })
  : null;

const messageRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, '1 m'),
      analytics: true,
      prefix: '@ratelimit/message',
    })
  : null;

const globalRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(120, '1 m'),
      analytics: true,
      prefix: '@ratelimit/global',
    })
  : null;

// ──────────────────────────────────────────────
// EXPORTED RATE LIMITER HELPER FUNCTIONS
// ──────────────────────────────────────────────

/** Tier 1: Auth & Security (30 requests / 1 min per IP) */
export async function checkRateLimitAuth(identifier: string) {
  if (authRatelimit) {
    try {
      return await withTimeout(authRatelimit.limit(identifier), 350);
    } catch {
      // Fallback on timeout
    }
  }
  return await memoryLimiter.check(`auth:${identifier}`, 30, 60 * 1000);
}

/** Tier 2: Media Uploads (15 requests / 1 min per User ID) */
export async function checkRateLimitUpload(identifier: string) {
  if (uploadRatelimit) {
    try {
      return await withTimeout(uploadRatelimit.limit(identifier), 350);
    } catch {
      // Fallback on timeout
    }
  }
  return await memoryLimiter.check(`upload:${identifier}`, 15, 60 * 1000);
}

/** Tier 2: Database Mutations (30 requests / 1 min per User ID) */
export async function checkRateLimitMutation(identifier: string) {
  if (mutationRatelimit) {
    try {
      return await withTimeout(mutationRatelimit.limit(identifier), 350);
    } catch {
      // Fallback on timeout
    }
  }
  return await memoryLimiter.check(`mutation:${identifier}`, 30, 60 * 1000);
}

/** Tier 3: Direct Messaging (60 requests / 1 min per User ID) */
export async function checkRateLimitMessage(identifier: string) {
  if (messageRatelimit) {
    try {
      return await withTimeout(messageRatelimit.limit(identifier), 350);
    } catch {
      // Fallback on timeout
    }
  }
  return await memoryLimiter.check(`msg:${identifier}`, 60, 60 * 1000);
}

/** Tier 4: Global Route Rate Limiting (120 requests / 1 min per IP) */
export async function checkRateLimitGlobal(identifier: string) {
  if (globalRatelimit) {
    try {
      return await withTimeout(globalRatelimit.limit(identifier), 350);
    } catch {
      // Fallback on timeout
    }
  }
  return await memoryLimiter.check(`global:${identifier}`, 120, 60 * 1000);
}
