import "server-only";
import { redis } from "@/lib/redis/client";
import { createBackfillStore } from "./backfill-state";
import type { ProviderBudgetStore } from "./budget";

/** Budget giornaliero delle fonti a quota su Redis: condiviso tra i pod, si azzera da solo dopo due giorni. */
export const redisBudgetStore: ProviderBudgetStore = {
  async tryConsume(provider, dailyLimit, dayKey) {
    const key = `market:budget:${provider}:${dayKey}`;
    const [[, used]] = (await redis.multi().incr(key).expire(key, 2 * 24 * 60 * 60).exec()) as [[unknown, number]];
    return used <= dailyLimit;
  },
};

/** Stato dei recuperi storici su Redis. */
export const redisBackfillStore = createBackfillStore({
  get: (key) => redis.get(key),
  async set(key, value, ttlSeconds) {
    await redis.set(key, value, "EX", ttlSeconds);
  },
});
