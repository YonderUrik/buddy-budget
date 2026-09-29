import "server-only";
import { redis } from "@/lib/redis/client";
import type { InvestmentHistoryStateStore } from "./history-state";

/** Scadenza dell'impronta: oltre, lo storico si ricalcola una volta anche se nulla è cambiato. */
const FINGERPRINT_TTL_SECONDS = 7 * 24 * 60 * 60;

const key = (userId: string) => `net-worth:investments:fingerprint:${userId}`;

/** Impronta dello storico investimenti su Redis, condivisa tra i pod. */
export const redisHistoryStateStore: InvestmentHistoryStateStore = {
  get: (userId) => redis.get(key(userId)),
  async set(userId, fingerprint) {
    await redis.set(key(userId), fingerprint, "EX", FINGERPRINT_TTL_SECONDS);
  },
};
