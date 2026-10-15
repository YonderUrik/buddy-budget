import "server-only";
import { redis } from "@/lib/redis/client";
import type { RateLimitStore } from "./rate-limit";

/** Adapter Redis di `RateLimitStore`, usato dallo scheduler e dal sync iniziale post-collegamento. */
export const redisRateLimitStore: RateLimitStore = {
  async get(key) {
    return redis.get(key);
  },
  async set(key, value, ttlSeconds) {
    await redis.set(key, value, "EX", Math.max(1, Math.floor(ttlSeconds)));
  },
};
