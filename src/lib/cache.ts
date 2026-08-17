import { Redis } from '@upstash/redis';

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

// In-Memory L1 Fallback Cache
const memoryCache = new Map<string, { value: any; expiresAt: number }>();

/** Helper to race a promise with a timeout (default 350ms) */
function withTimeout<T>(promise: Promise<T>, ms: number = 350): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Cache timeout')), ms)),
  ]);
}

/** Fetch cached item from L1 Memory or L2 Redis with timeout guard */
export async function getCache<T>(key: string): Promise<T | null> {
  // 1. Check fast in-memory L1 cache first (0ms)
  const l1Item = memoryCache.get(key);
  if (l1Item) {
    if (Date.now() < l1Item.expiresAt) {
      return l1Item.value as T;
    }
    memoryCache.delete(key);
  }

  // 2. Fall back to L2 Redis with strict 350ms timeout guard
  if (redis) {
    try {
      const data = await withTimeout(redis.get<T>(key), 350);
      if (data !== null && data !== undefined) {
        // Hydrate L1 memory cache for remaining TTL
        memoryCache.set(key, { value: data, expiresAt: Date.now() + 60 * 1000 });
        return data;
      }
    } catch (err) {
      // Redis timed out or threw error -> degrade gracefully without blocking
    }
  }

  return null;
}

/** Set item in L1 Memory and asynchronously in L2 Redis */
export async function setCache<T>(key: string, data: T, ttlSeconds: number = 120): Promise<void> {
  // 1. Immediately write to fast L1 memory
  memoryCache.set(key, {
    value: data,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });

  // 2. Asynchronously write to L2 Redis without blocking the caller
  if (redis) {
    withTimeout(redis.set(key, data, { ex: ttlSeconds }), 500).catch((err) => {
      // Non-critical background cache write error
    });
  }
}

/** Invalidate/Delete cache key across L1 Memory and L2 Redis */
export async function delCache(key: string): Promise<void> {
  memoryCache.delete(key);

  if (redis) {
    withTimeout(redis.del(key), 500).catch(() => {});
  }
}
