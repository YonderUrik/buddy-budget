import { SYNC_JOB_STALE_MS, SYNC_JOB_TTL_SECONDS } from "@/lib/sync-jobs/types";
import { CRON_NAMES, type CronName } from "./metrics";

/** Chiave Redis dell'ultimo successo di un cron (epoch in secondi, senza TTL). */
export function cronHeartbeatKey(cron: CronName): string {
  return `ops:heartbeat:cron:${cron}`;
}

/** Sorted set dei job di sync in corso: membro = jobId, score = ultimo heartbeat (ms). */
export const RUNNING_JOBS_KEY = "ops:sync-jobs:running";

/** Operazioni Redis minime usate dallo store operativo (iniettabili nei test). */
export interface OpsKv {
  get(key: string): Promise<string | null>;
  mget(keys: string[]): Promise<(string | null)[]>;
  set(key: string, value: string): Promise<void>;
  zadd(key: string, score: number, member: string): Promise<void>;
  zrem(key: string, member: string): Promise<void>;
  zcount(key: string, min: number | "-inf", max: number | "+inf"): Promise<number>;
  zremrangebyscore(key: string, min: number | "-inf", max: number): Promise<void>;
}

/**
 * Stato operativo condiviso tra i pod (letto allo scrape delle metriche): ultimo successo dei cron
 * e job di sync in corso. Serve Redis perché i contatori in memoria sono per-pod e si azzerano ai rollout.
 */
export interface OpsStore {
  setCronSuccess(cron: CronName, epochSeconds: number): Promise<void>;
  getCronSuccesses(): Promise<Record<CronName, number | null>>;
  markJobRunning(jobId: string, nowMs: number): Promise<void>;
  markJobDone(jobId: string): Promise<void>;
  countJobs(nowMs: number): Promise<{ active: number; stale: number }>;
}

/** Crea lo store operativo sopra un `OpsKv`. */
export function createOpsStore(kv: OpsKv): OpsStore {
  return {
    async setCronSuccess(cron, epochSeconds) {
      await kv.set(cronHeartbeatKey(cron), String(epochSeconds));
    },
    async getCronSuccesses() {
      const values = await kv.mget(CRON_NAMES.map(cronHeartbeatKey));
      const out = {} as Record<CronName, number | null>;
      CRON_NAMES.forEach((cron, i) => {
        const n = values[i] === null ? NaN : Number(values[i]);
        out[cron] = Number.isFinite(n) ? n : null;
      });
      return out;
    },
    async markJobRunning(jobId, nowMs) {
      await kv.zadd(RUNNING_JOBS_KEY, nowMs, jobId);
    },
    async markJobDone(jobId) {
      await kv.zrem(RUNNING_JOBS_KEY, jobId);
    },
    async countJobs(nowMs) {
      // Voci più vecchie del TTL dei job: processi morti senza markJobDone, non più interessanti.
      await kv.zremrangebyscore(RUNNING_JOBS_KEY, "-inf", nowMs - SYNC_JOB_TTL_SECONDS * 1000);
      const staleBefore = nowMs - SYNC_JOB_STALE_MS;
      const stale = await kv.zcount(RUNNING_JOBS_KEY, "-inf", staleBefore);
      const active = await kv.zcount(RUNNING_JOBS_KEY, staleBefore + 1, "+inf");
      return { active, stale };
    },
  };
}

/** `OpsKv` in memoria, per i test. */
export function createMemoryOpsKv(): OpsKv {
  const strings = new Map<string, string>();
  const zsets = new Map<string, Map<string, number>>();
  const zset = (key: string) => {
    let z = zsets.get(key);
    if (!z) zsets.set(key, (z = new Map()));
    return z;
  };
  const inRange = (score: number, min: number | "-inf", max: number | "+inf") =>
    (min === "-inf" || score >= min) && (max === "+inf" || score <= max);
  return {
    get: async (key) => strings.get(key) ?? null,
    mget: async (keys) => keys.map((k) => strings.get(k) ?? null),
    set: async (key, value) => void strings.set(key, value),
    zadd: async (key, score, member) => void zset(key).set(member, score),
    zrem: async (key, member) => void zset(key).delete(member),
    zcount: async (key, min, max) => [...zset(key).values()].filter((s) => inRange(s, min, max)).length,
    zremrangebyscore: async (key, min, max) => {
      const z = zset(key);
      for (const [member, score] of z) if (inRange(score, min, max)) z.delete(member);
    },
  };
}
