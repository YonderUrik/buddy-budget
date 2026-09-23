import "server-only";
import { redis } from "@/lib/redis/client";
import { createSyncJobStore, type SyncJobKv } from "./store";

/** Adapter ioredis di `SyncJobKv`. */
const redisSyncJobKv: SyncJobKv = {
  get: (key) => redis.get(key),
  async set(key, value, ttlSeconds) {
    await redis.set(key, value, "EX", ttlSeconds);
  },
  async setIfAbsent(key, value, ttlSeconds) {
    return (await redis.set(key, value, "EX", ttlSeconds, "NX")) === "OK";
  },
  async del(key) {
    await redis.del(key);
  },
  async addToSet(key, member, ttlSeconds) {
    await redis.multi().sadd(key, member).expire(key, ttlSeconds).exec();
  },
  setMembers: (key) => redis.smembers(key),
};

/** Store dei job di sync usato dalle route e dallo scheduler. */
export const redisSyncJobStore = createSyncJobStore(redisSyncJobKv);
