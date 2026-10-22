import "server-only";
import { redis } from "@/lib/redis/client";
import { GENERATION_STALE_MS, GENERATION_MAX_MS, GENERATION_TTL_SECONDS, generationView, type GenerationJob } from "./generation";

const keyFor = (userId: string) => `categorization-generation:${userId}`;

/** Reads only the authenticated user's latest run, including interrupted work. */
export async function readGenerationJob(userId: string): Promise<GenerationJob | null> {
  const raw = await redis.get(keyFor(userId));
  return generationView(raw ? JSON.parse(raw) as GenerationJob : null);
}

/** Atomically reuse live work across tabs/replicas, or start a new run. */
export async function startGenerationJob(userId: string): Promise<{ job: GenerationJob; created: boolean }> {
  const job: GenerationJob = { id: crypto.randomUUID(), status: "running", processed: 0, total: 0, stored: 0, blocked: 0, startedAt: Date.now(), updatedAt: Date.now() };
  const raw = await redis.eval(`
    local current = redis.call('GET', KEYS[1])
    if current then
      local job = cjson.decode(current)
      if job.status == 'running' and tonumber(ARGV[2]) - job.updatedAt <= tonumber(ARGV[3]) and tonumber(ARGV[2]) - job.startedAt <= tonumber(ARGV[5]) then return current end
    end
    redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[4])
    return ARGV[1]
  `, 1, keyFor(userId), JSON.stringify(job), job.updatedAt, GENERATION_STALE_MS, GENERATION_TTL_SECONDS, GENERATION_MAX_MS) as string;
  const stored = JSON.parse(raw) as GenerationJob;
  return { job: stored, created: stored.id === job.id };
}

/** Old callbacks cannot overwrite a newer run after interruption/retry. */
export async function writeGenerationJob(userId: string, job: GenerationJob): Promise<void> {
  await redis.eval(`
    local current = redis.call('GET', KEYS[1])
    if current and cjson.decode(current).id == ARGV[1] and cjson.decode(current).status == 'running' then
      redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
    end
  `, 1, keyFor(userId), job.id, JSON.stringify({ ...job, updatedAt: Date.now() }), GENERATION_TTL_SECONDS);
}
