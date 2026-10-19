import "server-only";
import { redis } from "@/lib/redis/client";
import type { InvestmentHistoryStateStore } from "./history-state";

/** Scadenza dell'impronta: oltre, lo storico si ricalcola una volta anche se nulla è cambiato. */
const FINGERPRINT_TTL_SECONDS = 7 * 24 * 60 * 60;

/** Redis key of a user's fingerprint (also cleared by the demo seed when it re-creates the demo user). */
export const investmentHistoryFingerprintKey = (userId: string) => `net-worth:investments:fingerprint:${userId}`;
const key = investmentHistoryFingerprintKey;

/** Redis key of the fingerprint of a user's cash history (see `refreshDerivedCashHistory`). */
export const cashHistoryFingerprintKey = (userId: string) => `net-worth:cash:fingerprint:${userId}`;

function redisStore(keyOf: (userId: string) => string): InvestmentHistoryStateStore {
  return {
    get: (userId) => redis.get(keyOf(userId)),
    async set(userId, fingerprint) {
      await redis.set(keyOf(userId), fingerprint, "EX", FINGERPRINT_TTL_SECONDS);
    },
  };
}

/** Impronta dello storico investimenti su Redis, condivisa tra i pod. */
export const redisHistoryStateStore: InvestmentHistoryStateStore = redisStore(key);

/** Fingerprint of the cash history on Redis, shared between pods. */
export const redisCashHistoryStateStore: InvestmentHistoryStateStore = redisStore(cashHistoryFingerprintKey);
