import "server-only";
import { redis } from "@/lib/redis/client";
import { createBackfillStore } from "./backfill-state";
import type { ProviderBudgetStore } from "./budget";
import type { YahooSessionStore } from "./providers/yahoo";

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

const YAHOO_SESSION_KEY = "market:yahoo:session";
const YAHOO_COOLDOWN_KEY = "market:yahoo:cooldown";

/**
 * Sessione Yahoo (cookie + crumb) e raffreddamento dopo un rifiuto, su Redis: condivisi tra i pod e sopravvivono
 * ai riavvii, invece di rinegoziare da zero a ogni redeploy/replica.
 */
export const redisYahooSessionStore: YahooSessionStore = {
  async get() {
    const raw = await redis.get(YAHOO_SESSION_KEY);
    if (raw === null) return undefined;
    return raw === "null" ? null : (JSON.parse(raw) as { cookie: string; crumb: string | null });
  },
  async set(session, ttlSeconds) {
    await redis.set(YAHOO_SESSION_KEY, session === null ? "null" : JSON.stringify(session), "EX", ttlSeconds);
  },
  async isCoolingDown() {
    return (await redis.exists(YAHOO_COOLDOWN_KEY)) === 1;
  },
  async markRefused(ttlSeconds) {
    await redis.set(YAHOO_COOLDOWN_KEY, "1", "EX", ttlSeconds);
  },
  async clear() {
    await redis.del(YAHOO_SESSION_KEY, YAHOO_COOLDOWN_KEY);
  },
};
