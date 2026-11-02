import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { client, db } from "@/lib/db/client";
import { instrumentPrices, instruments } from "@/lib/db/schema/investments";
import { createBackfillStore, createMemoryBackfillKv, BACKFILL_STALE_MS } from "@/lib/market-data/backfill-state";
import { DAILY_LOOKBACK_DAYS } from "@/lib/market-data/update";
import { findCoveredFrom } from "@/lib/market-data/store";
import { ensureHistory, setBackfillStore } from "@/lib/market-data/runtime";

/**
 * Il difetto: `ensureHistory` decideva se avviare il recupero dall'esistenza di una sola chiusura entro `fromKey`
 * (`min(date) <= fromKey`), non dalla copertura dell'intervallo richiesto. Con un vecchio prezzo isolato il
 * recupero non partiva, quindi `fromKey..oggi` restava senza prezzi e l'endpoint che precompila il prezzo di
 * un'operazione rispondeva `price: null, loading: false` per sempre, senza nulla in recupero.
 *
 * La divisione di responsabilità è: la copertura si misura qui (`findCoveredFrom`, usata da `lib/investments`),
 * e `ensureHistory` persegue l'intervallo richiesto senza dedurre nulla da una singola data.
 */
describe("copertura dello storico e avvio del recupero", () => {
  const instrumentIds: string[] = [];
  const kv = createMemoryBackfillKv();
  let store = createBackfillStore(kv);

  async function createInstrument(priceMode: "auto" | "manuale" = "auto"): Promise<string> {
    const [row] = await db
      .insert(instruments)
      .values({ name: `Titolo ${crypto.randomUUID().slice(0, 6)}`, type: "azione", currency: "EUR", priceMode })
      .returning();
    instrumentIds.push(row.id);
    return row.id;
  }

  async function addPrice(instrumentId: string, date: string): Promise<void> {
    await db.insert(instrumentPrices).values({ instrumentId, date, close: "100", source: "yahoo" }).onConflictDoNothing();
  }

  async function instrument(id: string) {
    const [row] = await db.select().from(instruments).where(eq(instruments.id, id));
    return row;
  }

  beforeAll(() => {
    setBackfillStore(store);
  });

  afterEach(async () => {
    store = createBackfillStore(kv);
    setBackfillStore(store);
    await db.delete(instruments).where(inArray(instruments.id, instrumentIds));
    instrumentIds.length = 0;
  });

  afterAll(async () => {
    setBackfillStore(null);
    await client.end();
  });

  it("avvia il recupero dell'intervallo richiesto anche con un prezzo molto più vecchio", async () => {
    const id = await createInstrument();
    await addPrice(id, "2026-01-05"); // prezzo isolato, molto prima dell'intervallo richiesto

    const scheduled: Array<() => Promise<void>> = [];
    const started = await ensureHistory(await instrument(id), "2026-05-01", (task) => scheduled.push(task));

    expect(started).toBe(true);
    expect(scheduled).toHaveLength(1);
  });

  it("con un prezzo isolato su un periodo vuoto non c'è copertura", async () => {
    const id = await createInstrument();
    await addPrice(id, "2026-01-05");
    await addPrice(id, "2026-05-20");

    // Il buco gennaio→maggio è in mezzo: la copertura recente parte dal 20 maggio, non dal prezzo di gennaio.
    expect(await findCoveredFrom(id, "2026-05-25", DAILY_LOOKBACK_DAYS)).toBe("2026-05-20");
  });

  it("un prezzo solo, molto prima di oggi, non è copertura", async () => {
    const id = await createInstrument();
    await addPrice(id, "2026-01-05");

    // Un unico prezzo isolato non dice che il periodo fino al 25 maggio sia coperto.
    expect(await findCoveredFrom(id, "2026-05-25", DAILY_LOOKBACK_DAYS)).toBeNull();
  });

  it("riconosce un buco interno con prezzi agli estremi e in mezzo", async () => {
    const id = await createInstrument();
    await addPrice(id, "2026-01-05");
    await addPrice(id, "2026-02-05");
    await addPrice(id, "2026-08-10");
    await addPrice(id, "2026-08-12");

    // Il buco febbraio→agosto è più lungo della tolleranza: la copertura continua parte dal 10 agosto.
    expect(await findCoveredFrom(id, "2026-08-12", DAILY_LOOKBACK_DAYS)).toBe("2026-08-10");
  });

  it("non scambia un weekend per un buco", async () => {
    const id = await createInstrument();
    // Venerdì 2026-05-01 e mercoledì 2026-05-06 (il lunedì può mancare per un festivo).
    await addPrice(id, "2026-05-01");
    await addPrice(id, "2026-05-06");

    expect(await findCoveredFrom(id, "2026-05-06", DAILY_LOOKBACK_DAYS)).toBe("2026-05-01");
  });

  it("con lo storico vuoto non c'è copertura", async () => {
    const id = await createInstrument();
    expect(await findCoveredFrom(id, "2026-05-25", DAILY_LOOKBACK_DAYS)).toBeNull();
  });

  it("ignora i prezzi successivi alla data richiesta", async () => {
    const id = await createInstrument();
    await addPrice(id, "2026-01-05");
    await addPrice(id, "2026-03-05");
    await addPrice(id, "2026-09-01");

    // Chiedendo una data a marzo, il prezzo di settembre non deve fingere una copertura.
    expect(await findCoveredFrom(id, "2026-03-05", DAILY_LOOKBACK_DAYS)).toBe("2026-03-05");
  });

  it("due richieste simultanee avviano un solo recupero", async () => {
    const id = await createInstrument();
    const target = await instrument(id);
    const started = await Promise.all([
      ensureHistory(target, "2026-05-01", () => {}),
      ensureHistory(target, "2026-05-01", () => {}),
      ensureHistory(target, "2026-05-01", () => {}),
    ]);

    expect(started.filter(Boolean)).toHaveLength(1);
  });

  it("non avvia un recupero mentre uno è in corso, e riparte se è rimasto senza heartbeat", async () => {
    const id = await createInstrument();
    const target = await instrument(id);

    expect(await ensureHistory(target, "2026-05-01", () => {})).toBe(true);
    expect(await ensureHistory(target, "2026-05-01", () => {})).toBe(false); // in corso

    // Un recupero che ha perso l'heartbeat (funzione morta) si può riprendere; uno vivo no.
    const [state] = await store.views([id]);
    await kv.set(`market:backfill:${id}`, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }), 3600);
    expect(await ensureHistory(target, "2026-05-01", () => {})).toBe(false);

    const stale = { ...state, updatedAt: new Date(Date.now() - BACKFILL_STALE_MS - 1).toISOString() };
    await kv.set(`market:backfill:${id}`, JSON.stringify(stale), 3600);
    expect(await ensureHistory(target, "2026-05-01", () => {})).toBe(true);
  });

  it("non recupera nulla per uno strumento a prezzo manuale", async () => {
    const id = await createInstrument("manuale");
    expect(await ensureHistory(await instrument(id), "2026-05-01", () => {})).toBe(false);
  });
});
