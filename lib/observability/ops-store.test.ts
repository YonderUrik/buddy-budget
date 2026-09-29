import { describe, expect, it } from "vitest";
import { SYNC_JOB_STALE_MS, SYNC_JOB_TTL_SECONDS } from "@/lib/sync-jobs/types";
import { createLogger } from "./logger";
import { recordCronRun } from "./heartbeat";
import { createMemoryOpsKv, createOpsStore, type OpsStore } from "./ops-store";

describe("OpsStore", () => {
  it("salva e rilegge l'ultimo successo dei cron, null se mai eseguito", async () => {
    const store = createOpsStore(createMemoryOpsKv());
    await store.setCronSuccess("gocardless_sync", 1_790_000_000);
    expect(await store.getCronSuccesses()).toEqual({ gocardless_sync: 1_790_000_000, net_worth_snapshot: null, market_prices: null, account_deletion: null });
  });

  it("separa job attivi e bloccati e pulisce le voci più vecchie del TTL", async () => {
    const store = createOpsStore(createMemoryOpsKv());
    const now = 10_000_000_000;
    await store.markJobRunning("fresh", now - 1000);
    await store.markJobRunning("stale", now - SYNC_JOB_STALE_MS - 1000);
    await store.markJobRunning("ancient", now - SYNC_JOB_TTL_SECONDS * 1000 - 1);
    await store.markJobRunning("done", now);
    await store.markJobDone("done");
    expect(await store.countJobs(now)).toEqual({ active: 1, stale: 1 });
    expect(await store.countJobs(now)).toEqual({ active: 1, stale: 1 });
  });
});

describe("recordCronRun", () => {
  function capture() {
    const lines: Record<string, unknown>[] = [];
    return { lines, log: createLogger({ level: "debug", write: (l) => lines.push(JSON.parse(l)) }) };
  }

  it("scrive l'heartbeat solo su successo", async () => {
    const store = createOpsStore(createMemoryOpsKv());
    const { log, lines } = capture();
    await recordCronRun("net_worth_snapshot", "error", 10, { store, log, error: new Error("DB giù") });
    expect((await store.getCronSuccesses()).net_worth_snapshot).toBeNull();
    await recordCronRun("net_worth_snapshot", "success", 10, { store, log, now: () => 5_000_000 });
    expect((await store.getCronSuccesses()).net_worth_snapshot).toBe(5000);
    expect(lines.map((l) => l.event)).toEqual(["cron.net_worth_snapshot.failed", "cron.net_worth_snapshot.completed"]);
  });

  it("un errore di scrittura dell'heartbeat non fa fallire il cron", async () => {
    const failing = { setCronSuccess: async () => { throw new Error("redis giù"); } } as unknown as OpsStore;
    const { log, lines } = capture();
    await expect(recordCronRun("gocardless_sync", "success", 1, { store: failing, log })).resolves.toBeUndefined();
    expect(lines.at(-1)).toMatchObject({ event: "cron.heartbeat.write_failed", level: "warn" });
  });
});
