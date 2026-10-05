import "server-only";
import { redis } from "@/lib/redis/client";
import type { CachedLogo, LogoStore } from "./logo-service";

const KEY_PREFIX = "instrument:logo:";
const COOLDOWN_KEY = "instrument:logo:cooldown";

/** Logo e pausa dopo un errore su Redis: condivisi tra i pod e sopravvivono ai riavvii. */
export const redisLogoStore: LogoStore = {
  async get(key) {
    const raw = await redis.get(`${KEY_PREFIX}${key}`);
    if (raw === null) return undefined;
    return JSON.parse(raw) as CachedLogo;
  },
  async set(key, value, ttlSeconds) {
    await redis.set(`${KEY_PREFIX}${key}`, JSON.stringify(value), "EX", ttlSeconds);
  },
  async isCoolingDown() {
    return (await redis.exists(COOLDOWN_KEY)) === 1;
  },
  async markCoolingDown(ttlSeconds) {
    await redis.set(COOLDOWN_KEY, "1", "EX", ttlSeconds);
  },
};
