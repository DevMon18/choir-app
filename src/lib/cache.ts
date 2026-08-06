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

// In-Memory Fallback Cache (for when Upstash env is absent in local dev)
const memoryCache = new Map<string, { value: any; expiresAt: number }>();

/** Fetch cached item from Redis or Memory */
export async function getCache<T>(key: string): Promise<T | null> {
  try {
    if (redis) {
      const data = await redis.get<T>(key);
      return data;
    }

    const item = memoryCache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      memoryCache.delete(key);
      return null;
    }
    return item.value as T;
  } catch (err) {
    console.error(`getCache error for key ${key}:`, err);
    return null;
  }
}

/** Set item in Redis or Memory with TTL (in seconds, default 120s) */
export async function setCache<T>(key: string, data: T, ttlSeconds: number = 120): Promise<void> {
  try {
    if (redis) {
      await redis.set(key, data, { ex: ttlSeconds });
      return;
    }

    memoryCache.set(key, {
      value: data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  } catch (err) {
    console.error(`setCache error for key ${key}:`, err);
  }
}

/** Invalidate/Delete cache key or pattern */
export async function delCache(key: string): Promise<void> {
  try {
    if (redis) {
      await redis.del(key);
      return;
    }
    memoryCache.delete(key);
  } catch (err) {
    console.error(`delCache error for key ${key}:`, err);
  }
}
