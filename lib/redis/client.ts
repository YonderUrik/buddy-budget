import "server-only";
import { Redis } from "ioredis";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL non è definita. Copia .env.local.example in .env.local.");
}

export const redis = new Redis(redisUrl);
