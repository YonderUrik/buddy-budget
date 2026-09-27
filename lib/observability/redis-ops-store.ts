import "server-only";
import { redis } from "@/lib/redis/client";
import { createOpsStore, type OpsKv } from "./ops-store";

const redisOpsKv: OpsKv = {
  get: (key) => redis.get(key),
  mget: (keys) => redis.mget(...keys),
  async set(key, value) {
    await redis.set(key, value);
  },
  async zadd(key, score, member) {
    await redis.zadd(key, score, member);
  },
  async zrem(key, member) {
    await redis.zrem(key, member);
  },
  zcount: (key, min, max) => redis.zcount(key, min, max),
  async zremrangebyscore(key, min, max) {
    await redis.zremrangebyscore(key, min, max);
  },
};

/** Store operativo su Redis (heartbeat dei cron, job di sync in corso). */
export const redisOpsStore = createOpsStore(redisOpsKv);
