import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { client, db } from "@/lib/db/client";
import { instrumentPrices, instruments } from "@/lib/db/schema/investments";
import { createBackfillStore, createMemoryBackfillKv, BACKFILL_STALE_MS } from "@/lib/market-data/backfill-state";
import { DAILY_LOOKBACK_DAYS } from "@/lib/market-data/update";
import { findCoveredFrom } from "@/lib/market-data/store";
import { ensureHistory, setBackfillStore } from "@/lib/market-data/runtime";

/**
 * The defect: `ensureHistory` decided whether to start a backfill from the existence of a single close at or
 * before `fromKey` (`min(date) <= fromKey`), not from the coverage of the requested interval. With one close much
 * older than the interval, the backfill did not start, so `fromKey..today` stayed empty and the endpoint that
 * pre-fills the price of an operation answered `price: null, loading: false` for good, with nothing running.
 *
 * Responsibilities are split: coverage is measured here (`findCoveredFrom`, used by `lib/investments`), and
 * `ensureHistory` pursues the requested interval without inferring anything from a single date.
 */
describe("history coverage and backfill start", () => {
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

  /** Coverage of an interval `fromKey`–`toKey`, the way `historyCovers` asks for it. */
  function covered(id: string, fromKey: string, toKey: string) {
    return findCoveredFrom(id, fromKey, toKey, DAILY_LOOKBACK_DAYS);
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

  it("starts the backfill of the requested interval even with a much older close", async () => {
    const id = await createInstrument();
    await addPrice(id, "2026-01-05"); // isolated close, long before the requested interval

    const scheduled: Array<() => Promise<void>> = [];
    const started = await ensureHistory(await instrument(id), "2026-05-01", (task) => scheduled.push(task));

    expect(started).toBe(true);
    expect(scheduled).toHaveLength(1);
    expect((await store.views([id]))[0].fromKey).toBe("2026-05-01");
  });

  it("a lone close on an otherwise empty period is not coverage", async () => {
    const id = await createInstrument();
    await addPrice(id, "2026-01-05");

    // A single isolated close does not say the period up to 25 May is covered.
    expect(await covered(id, "2026-05-01", "2026-05-25")).toBeNull();
  });

  it("recognises an inner gap even with closes at both ends", async () => {
    const id = await createInstrument();
    await addPrice(id, "2026-01-05");
    await addPrice(id, "2026-02-05");
    await addPrice(id, "2026-08-10");
    await addPrice(id, "2026-08-12");

    // The February→August gap is wider than the tolerance: continuous coverage starts on 10 August.
    expect(await covered(id, "2026-01-05", "2026-08-12")).toBe("2026-08-10");
  });

  it("does not mistake a weekend for a gap", async () => {
    const id = await createInstrument();
    // Friday 2026-05-01 and Wednesday 2026-05-06 (the Monday may be missing for a holiday).
    await addPrice(id, "2026-05-01");
    await addPrice(id, "2026-05-06");

    expect(await covered(id, "2026-05-01", "2026-05-06")).toBe("2026-05-01");
  });

  it("an empty history has no coverage", async () => {
    const id = await createInstrument();
    expect(await covered(id, "2026-05-01", "2026-05-25")).toBeNull();
  });

  it("ignores closes after the requested end date", async () => {
    const id = await createInstrument();
    await addPrice(id, "2026-03-01");
    await addPrice(id, "2026-03-05");
    await addPrice(id, "2026-09-01");

    // Asking for a date in March, the September close must not pretend the interval is covered: coverage comes
    // from the March run, and the September close is outside the window.
    expect(await covered(id, "2026-03-01", "2026-03-05")).toBe("2026-03-01");
  });

  it("reports coverage only when it reaches the requested start", async () => {
    const id = await createInstrument();
    // A long, continuous run that starts after the requested `fromKey`.
    await addPrice(id, "2026-06-01");
    await addPrice(id, "2026-06-03");
    await addPrice(id, "2026-06-05");

    expect(await covered(id, "2026-06-01", "2026-06-05")).toBe("2026-06-01");
    expect(await covered(id, "2026-01-01", "2026-06-05")).toBeNull();
  });

  it("closes older than the window cannot change the answer", async () => {
    const id = await createInstrument();
    // Very old closes, then a continuous recent run: the old rows must not affect the outcome either way.
    await addPrice(id, "2020-01-05");
    await addPrice(id, "2020-01-10");
    await addPrice(id, "2026-06-01");
    await addPrice(id, "2026-06-03");

    expect(await covered(id, "2026-06-01", "2026-06-03")).toBe("2026-06-01");
  });

  it("two simultaneous requests start one backfill", async () => {
    const id = await createInstrument();
    const target = await instrument(id);
    const started = await Promise.all([
      ensureHistory(target, "2026-05-01", () => {}),
      ensureHistory(target, "2026-05-01", () => {}),
      ensureHistory(target, "2026-05-01", () => {}),
    ]);

    expect(started.filter(Boolean)).toHaveLength(1);
  });

  it("does not start a backfill while one is running, and resumes one left without a heartbeat", async () => {
    const id = await createInstrument();
    const target = await instrument(id);

    expect(await ensureHistory(target, "2026-05-01", () => {})).toBe(true);
    expect(await ensureHistory(target, "2026-05-01", () => {})).toBe(false); // running

    // A run that lost its heartbeat (function died) can resume; a live one cannot.
    const [state] = await store.views([id]);
    await kv.set(`market:backfill:${id}`, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }), 3600);
    expect(await ensureHistory(target, "2026-05-01", () => {})).toBe(false);
    const stale = { ...state, updatedAt: new Date(Date.now() - BACKFILL_STALE_MS - 1).toISOString() };
    await kv.set(`market:backfill:${id}`, JSON.stringify(stale), 3600);
    expect(await ensureHistory(target, "2026-05-01", () => {})).toBe(true);
  });

  it("an older interval starts even right after a completed recent backfill", async () => {
    const id = await createInstrument();
    const target = await instrument(id);

    // The common flow: the instrument is created with 30 days of history, then an operation from two years ago
    // is entered. The completed run must not block the older interval.
    expect(await ensureHistory(target, "2026-08-01", () => {})).toBe(true);
    await store.finish(id, "done", 30);

    expect(await ensureHistory(target, "2024-08-01", () => {})).toBe(true);
  });

  it("never backfills a manual-price instrument", async () => {
    const id = await createInstrument("manuale");
    expect(await ensureHistory(await instrument(id), "2026-05-01", () => {})).toBe(false);
  });
});
