import "server-only";
import { redis } from "@/lib/redis/client";
import { NAME_PRESENCE_TTL_SECONDS, type MerchantNameStore } from "./name-domain";

const DOMAIN_PREFIX = "merchant-logo:name:";
const USERS_PREFIX = "merchant-logo:users:";
const BUDGET_PREFIX = "merchant-logo:search-budget:";
const NO_DOMAIN = "-";
const BUDGET_TTL_SECONDS = 2 * 24 * 60 * 60;

/**
 * Cache dei siti trovati per nome e conteggio degli utenti per esercente su Redis. Gli utenti si contano con un HyperLogLog
 * di impronte (`hashUserId`): si sa quanti sono, non chi sono, e il conteggio scade da solo.
 */
export const redisMerchantNameStore: MerchantNameStore = {
  async getDomain(name) {
    const raw = await redis.get(`${DOMAIN_PREFIX}${name}`);
    if (raw === null) return undefined;
    return raw === NO_DOMAIN ? null : raw;
  },
  async setDomain(name, domain, ttlSeconds) {
    await redis.set(`${DOMAIN_PREFIX}${name}`, domain ?? NO_DOMAIN, "EX", ttlSeconds);
  },
  async addPresence(names, userHash) {
    if (names.length === 0) return;
    const pipeline = redis.pipeline();
    for (const name of names) {
      pipeline.pfadd(`${USERS_PREFIX}${name}`, userHash);
      pipeline.expire(`${USERS_PREFIX}${name}`, NAME_PRESENCE_TTL_SECONDS);
    }
    await pipeline.exec();
  },
  async countUsers(name) {
    return redis.pfcount(`${USERS_PREFIX}${name}`);
  },
  async takeSearchBudget(day, limit) {
    const key = `${BUDGET_PREFIX}${day}`;
    const used = await redis.incr(key);
    if (used === 1) await redis.expire(key, BUDGET_TTL_SECONDS);
    return used <= limit;
  },
};
