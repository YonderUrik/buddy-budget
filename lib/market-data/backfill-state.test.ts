import { describe, expect, it } from "vitest";
import {
  BACKFILL_COOLDOWN_MS,
  BACKFILL_STALE_MS,
  createBackfillStore,
  createMemoryBackfillKv,
  type BackfillKv,
} from "./backfill-state";

describe("stato del recupero storico", () => {
  it("non parte due volte mentre un recupero è vivo, riparte se è interrotto", async () => {
    let now = new Date("2026-09-28T10:00:00Z");
    const store = createBackfillStore(createMemoryBackfillKv(), () => now);
    expect(await store.tryStart("i1", "2026-01-01")).toBe(true);
    expect(await store.tryStart("i1", "2026-01-01")).toBe(false);
    now = new Date(now.getTime() + BACKFILL_STALE_MS + 1);
    expect((await store.views(["i1"]))[0].interrupted).toBe(true);
    expect(await store.tryStart("i1", "2026-01-01")).toBe(true);
  });

  it("tiene l'intervallo richiesto nello stato", async () => {
    const store = createBackfillStore(createMemoryBackfillKv());
    await store.tryStart("i1", "2026-01-01");
    await store.progress("i1", 500, 1200);
    expect((await store.views(["i1"]))[0].fromKey).toBe("2026-01-01");
  });

  it("registra avanzamento e fine; gli strumenti senza stato non compaiono", async () => {
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

  it("non riparte subito dopo un recupero completato, ma riparte dopo la pausa", async () => {
    let now = new Date("2026-09-28T10:00:00Z");
    const store = createBackfillStore(createMemoryBackfillKv(), () => now);
    await store.tryStart("i1", "2026-01-01");
    await store.finish("i1", "done", 10);

    // Una fonte che non conosce l'intervallo non va richiesta a ripetizione.
    expect(await store.tryStart("i1", "2026-01-01")).toBe(false);
    now = new Date(now.getTime() + BACKFILL_COOLDOWN_MS + 1);
    expect(await store.tryStart("i1", "2026-01-01")).toBe(true);
  });

  it("riparte subito dopo un tentativo fallito", async () => {
    const store = createBackfillStore(createMemoryBackfillKv());
    await store.tryStart("i1", "2026-01-01");
    await store.finish("i1", "failed", 0);
    expect(await store.tryStart("i1", "2026-01-01")).toBe(true);
  });

  it("due avvii simultanei con lo storico vuoto: uno solo scrive il proprio avvio", async () => {
    // KV con letture differite: simula la corsa in cui tutte le richieste leggono prima che la prima abbia scritto.
    // Il diritto di partenza lo assegna il `SET NX` (unico), non la lettura iniziale.
    const data = new Map<string, string>();
    const deferred: BackfillKv = {
      async get(k) {
        await new Promise((resolve) => setImmediate(resolve));
        return data.get(k) ?? null;
      },
      async set(k, v) {
        data.set(k, v);
      },
      async setIfAbsent(k, v) {
        await new Promise((resolve) => setImmediate(resolve));
        if (data.has(k)) return false;
        data.set(k, v);
        return true;
      },
    };
    const store = createBackfillStore(deferred);
    const outcomes = await Promise.all([
      store.tryStart("i1", "2026-01-01"),
      store.tryStart("i1", "2026-01-01"),
      store.tryStart("i1", "2026-01-01"),
    ]);

    // Al massimo una richiesta considera suo l'avvio; le altre si fermano o rileggono il vincitore.
    expect(outcomes.filter(Boolean).length).toBeLessThanOrEqual(1);
    expect(data.size).toBe(1);
  });
});
