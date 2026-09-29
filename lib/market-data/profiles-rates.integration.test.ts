import { eq, inArray } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import { instrumentProfiles, instrumentSymbols, instruments, interestRates, type Instrument } from "@/lib/db/schema/investments";
import { FAKE_PROFILE_PROVIDER, FAKE_RATE_PROVIDER } from "./fake";
import { findInstrumentsWithoutProfile, refreshInstrumentProfile, refreshStaleProfiles } from "./profiles";
import { ESTR_HISTORY_START, loadRiskFreeRates, updateRiskFreeRates } from "./rates";
import type { ProviderContext } from "./types";

const ctx: ProviderContext = { fetch: (() => Promise.reject(new Error("niente rete"))) as typeof fetch, env: {} };

describe("profili degli strumenti", () => {
  const created: string[] = [];

  async function createInstrument(type: Instrument["type"], yahoo: string | null): Promise<Instrument> {
    const [row] = await db.insert(instruments).values({ name: `Test ${crypto.randomUUID()}`, type, currency: "EUR" }).returning();
    created.push(row.id);
    if (yahoo) await db.insert(instrumentSymbols).values({ instrumentId: row.id, provider: "yahoo", symbol: yahoo });
    return row;
  }

  afterEach(async () => {
    if (created.length > 0) await db.delete(instruments).where(inArray(instruments.id, created));
    created.length = 0;
  });

  it("scarica solo i profili mancanti o vecchi, salva anche le risposte vuote", async () => {
    const etf = await createInstrument("etf", "VWCE.DE");
    const stock = await createInstrument("azione", "AAPL");
    const unknown = await createInstrument("etf", "NOPE.DE");
    const crypto = await createInstrument("crypto", null);
    const noSymbol = await createInstrument("etf", null);

    const summary = await refreshStaleProfiles([etf, stock, unknown, crypto, noSymbol], new Date(), ctx, { provider: FAKE_PROFILE_PROVIDER });
    expect(summary).toEqual({ candidates: 4, saved: 2, empty: 1, failed: 0 });

    const rows = await db.select().from(instrumentProfiles).where(inArray(instrumentProfiles.instrumentId, created));
    const byId = new Map(rows.map((r) => [r.instrumentId, r]));
    expect(byId.get(etf.id)?.holdings?.[0]).toMatchObject({ symbol: "NVDA" });
    expect(byId.get(stock.id)).toMatchObject({ sector: "tecnologia", country: "US", symbol: "AAPL" });
    expect(byId.get(unknown.id)).toMatchObject({ sectors: null, holdings: null });
    expect(byId.has(noSymbol.id)).toBe(false);

    // Al giro dopo sono tutti freschi: niente da scaricare (tranne quello senza simbolo, che non si salva).
    const again = await refreshStaleProfiles([etf, stock, unknown, noSymbol], new Date(), ctx, { provider: FAKE_PROFILE_PROVIDER });
    expect(again.candidates).toBe(1);
    expect((await findInstrumentsWithoutProfile([etf, stock, noSymbol])).map((i) => i.id)).toEqual([noSymbol.id]);
  });

  it("un errore della fonte non lancia", async () => {
    const etf = await createInstrument("etf", "VWCE.DE");
    const failing = { fetchProfile: async () => Promise.reject(new Error("429")) };
    expect(await refreshInstrumentProfile(etf, "VWCE.DE", ctx, { provider: failing })).toBe("failed");
  });
});

describe("€STR", () => {
  afterEach(async () => {
    await db.delete(interestRates).where(eq(interestRates.series, "estr"));
  });

  it("con la tabella vuota scarica dal 2019, poi solo gli ultimi giorni; un errore non lancia", async () => {
    await db.delete(interestRates).where(eq(interestRates.series, "estr"));
    const calls: string[] = [];
    const provider = {
      id: "ecb" as const,
      fetchDailyRates: async (from: string, to: string) => {
        calls.push(from);
        return FAKE_RATE_PROVIDER.fetchDailyRates(from < "2026-09-01" ? "2026-09-01" : from, to, ctx);
      },
    };
    const today = new Date("2026-09-29T12:00:00Z");
    expect(await updateRiskFreeRates(today, ctx, { provider })).toBeGreaterThan(0);
    await updateRiskFreeRates(today, ctx, { provider });
    expect(calls).toEqual([ESTR_HISTORY_START, "2026-08-30"]);
    const rates = await loadRiskFreeRates("2026-09-10");
    expect(rates.length).toBeGreaterThan(5);
    expect(rates.every((r) => r.rate === 0.02)).toBe(true);

    const failing = { id: "ecb" as const, fetchDailyRates: async () => Promise.reject(new Error("giù")) };
    expect(await updateRiskFreeRates(today, ctx, { provider: failing })).toBe(0);
  });
});
