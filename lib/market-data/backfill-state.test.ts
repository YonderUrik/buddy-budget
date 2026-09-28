import { describe, expect, it } from "vitest";
import { BACKFILL_STALE_MS, createBackfillStore, createMemoryBackfillKv } from "./backfill-state";

describe("stato del recupero storico", () => {
  it("non parte due volte mentre un recupero è vivo, riparte se è interrotto", async () => {
    let now = new Date("2026-09-28T10:00:00Z");
    const store = createBackfillStore(createMemoryBackfillKv(), () => now);
    expect(await store.tryStart("i1")).toBe(true);
    expect(await store.tryStart("i1")).toBe(false);
    now = new Date(now.getTime() + BACKFILL_STALE_MS + 1);
    expect((await store.views(["i1"]))[0].interrupted).toBe(true);
    expect(await store.tryStart("i1")).toBe(true);
  });

  it("registra avanzamento e fine; gli strumenti senza stato non compaiono", async () => {
    const store = createBackfillStore(createMemoryBackfillKv());
    await store.tryStart("i1");
    await store.progress("i1", 500, 1200);
    expect((await store.views(["i1", "i2"])).map((v) => [v.instrumentId, v.status, v.saved, v.total])).toEqual([
      ["i1", "running", 500, 1200],
    ]);
    await store.finish("i1", "done", 1200);
    const [done] = await store.views(["i1"]);
    expect([done.status, done.saved, done.interrupted]).toEqual(["done", 1200, false]);
  });
});
