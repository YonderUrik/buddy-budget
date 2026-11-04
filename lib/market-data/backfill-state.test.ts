import { describe, expect, it } from "vitest";
import {
  BACKFILL_COOLDOWN_MS,
  BACKFILL_STALE_MS,
  createBackfillStore,
  createMemoryBackfillKv,
  type BackfillKv,
} from "./backfill-state";

/** A KV that exposes its raw map, so a test can forge a state written by an older version. */
function kvWithData() {
  const data = new Map<string, string>();
  const kv: BackfillKv = {
    async get(key) {
      return data.get(key) ?? null;
    },
    async set(key, value) {
      data.set(key, value);
    },
    async setIfAbsent(key, value) {
      if (data.has(key)) return false;
      data.set(key, value);
      return true;
    },
  };
  return { kv, data };
}

describe("backfill state", () => {
  it("starts once while a run is alive, restarts when it is interrupted", async () => {
    let now = new Date("2026-09-28T10:00:00Z");
    const store = createBackfillStore(createMemoryBackfillKv(), () => now);
    expect(await store.tryStart("i1", "2026-01-01")).toBe(true);
    expect(await store.tryStart("i1", "2026-01-01")).toBe(false);
    now = new Date(now.getTime() + BACKFILL_STALE_MS + 1);
    expect((await store.views(["i1"]))[0].interrupted).toBe(true);
    expect(await store.tryStart("i1", "2026-01-01")).toBe(true);
  });

  it("keeps the requested interval in the state", async () => {
    const store = createBackfillStore(createMemoryBackfillKv());
    await store.tryStart("i1", "2026-01-01");
    await store.progress("i1", 500, 1200);
    expect((await store.views(["i1"]))[0].fromKey).toBe("2026-01-01");
  });

  it("records progress and completion; instruments without a state do not appear", async () => {
    const store = createBackfillStore(createMemoryBackfillKv());
    await store.tryStart("i1", "2026-01-01");
    await store.progress("i1", 500, 1200);
    expect((await store.views(["i1", "i2"])).map((v) => [v.instrumentId, v.status, v.saved, v.total])).toEqual([
      ["i1", "running", 500, 1200],
    ]);
    await store.finish("i1", "done", 1200);
    const [done] = await store.views(["i1"]);
    expect([done.status, done.saved, done.interrupted]).toEqual(["done", 1200, false]);
  });

  it("does not restart the same interval right after a completed run, but restarts after the cooldown", async () => {
    let now = new Date("2026-09-28T10:00:00Z");
    const store = createBackfillStore(createMemoryBackfillKv(), () => now);
    await store.tryStart("i1", "2026-01-01");
    await store.finish("i1", "done", 10);

    // A source that does not know an interval must not be asked for it again and again.
    expect(await store.tryStart("i1", "2026-01-01")).toBe(false);
    now = new Date(now.getTime() + BACKFILL_COOLDOWN_MS + 1);
    expect(await store.tryStart("i1", "2026-01-01")).toBe(true);
  });

  it("a completed run does not block an older interval", async () => {
    const store = createBackfillStore(createMemoryBackfillKv());
    // The common flow: the instrument is created with 30 days of history, then a purchase from two years ago is
    // entered. The second interval is not the work the first run did.
    await store.tryStart("i1", "2026-08-01");
    await store.finish("i1", "done", 30);

    expect(await store.tryStart("i1", "2024-08-01")).toBe(true);
  });

  it("a completed run covers any later interval, since a run always backfills up to today", async () => {
    const store = createBackfillStore(createMemoryBackfillKv());
    await store.tryStart("i1", "2026-01-01");
    await store.finish("i1", "done", 10);

    // `backfillInstrument` runs from `fromKey` to today, so January already covered March.
    expect(await store.tryStart("i1", "2026-03-01")).toBe(false);
  });

  it("a completed state written before this change covers no interval", async () => {
    const { kv, data } = kvWithData();
    const store = createBackfillStore(kv);
    await store.tryStart("i1", "2026-01-01");
    await store.finish("i1", "done", 10);
    // A row from an older version has no `fromKey`: it must not block anything.
    const stored = JSON.parse(data.get("market:backfill:i1") as string) as Record<string, unknown>;
    delete stored.fromKey;
    data.set("market:backfill:i1", JSON.stringify(stored));

    expect(await store.tryStart("i1", "2026-06-01")).toBe(true);
  });

  it("restarts right after a failed attempt", async () => {
    const store = createBackfillStore(createMemoryBackfillKv());
    await store.tryStart("i1", "2026-01-01");
    await store.finish("i1", "failed", 0);
    expect(await store.tryStart("i1", "2026-01-01")).toBe(true);
  });

  it("simultaneous starts on an empty history: only one writes its own start", async () => {
    // A KV with deferred reads: every request reads before the first one has written. The right to start is
    // assigned by the single `SET NX`, not by the initial read.
    const data = new Map<string, string>();
    const deferred: BackfillKv = {
      async get(key) {
        await new Promise((resolve) => setImmediate(resolve));
        return data.get(key) ?? null;
      },
      async set(key, value) {
        data.set(key, value);
      },
      async setIfAbsent(key, value) {
        await new Promise((resolve) => setImmediate(resolve));
        if (data.has(key)) return false;
        data.set(key, value);
        return true;
      },
    };
    const store = createBackfillStore(deferred);
    const outcomes = await Promise.all([
      store.tryStart("i1", "2026-01-01"),
      store.tryStart("i1", "2026-01-01"),
      store.tryStart("i1", "2026-01-01"),
    ]);

    // At most one request considers the start its own; the others stop or re-read the winner.
    expect(outcomes.filter(Boolean).length).toBeLessThanOrEqual(1);
    expect(data.size).toBe(1);
  });
});
