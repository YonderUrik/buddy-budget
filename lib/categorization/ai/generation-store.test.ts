import { afterAll, afterEach, expect, it } from "vitest";
import { redis } from "@/lib/redis/client";
import { readGenerationJob, startGenerationJob, writeGenerationJob } from "./generation-store";
import { GENERATION_STALE_MS } from "./generation";
const user = `test-generation-${crypto.randomUUID()}`;
afterEach(async () => { await redis.del(`categorization-generation:${user}`, `categorization-generation:${user}-other`); });
afterAll(async () => { await redis.quit(); });
it("deduplicates simultaneous clicks across replicas", async () => {
  const runs = await Promise.all(Array.from({ length: 5 }, () => startGenerationJob(user)));
  expect(new Set(runs.map((r) => r.job.id)).size).toBe(1);
  expect(runs.filter((r) => r.created)).toHaveLength(1);
  expect(await readGenerationJob(`${user}-other`)).toBeNull();
});
it("finishes blocked-only work and permits a new run", async () => {
  const { job } = await startGenerationJob(user);
  await writeGenerationJob(user, { ...job, status: "done", blocked: 12 });
  expect(await readGenerationJob(user)).toMatchObject({ status: "done", blocked: 12, stored: 0 });
  await writeGenerationJob(user, job);
  expect((await readGenerationJob(user))?.status).toBe("done");
  expect((await startGenerationJob(user)).created).toBe(true);
});
it("does not let an old callback overwrite a retry after interruption", async () => {
  const { job } = await startGenerationJob(user);
  await redis.set(`categorization-generation:${user}`, JSON.stringify({ ...job, updatedAt: Date.now() - GENERATION_STALE_MS - 1 }));
  expect((await readGenerationJob(user))?.status).toBe("failed");
  const retry = await startGenerationJob(user);
  expect(retry.created).toBe(true);
  await writeGenerationJob(user, { ...job, status: "done" });
  expect((await readGenerationJob(user))?.id).toBe(retry.job.id);
});
