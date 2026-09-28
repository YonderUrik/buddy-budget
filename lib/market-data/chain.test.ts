import { describe, expect, it, vi } from "vitest";
import { createMemoryBudgetStore } from "./budget";
import { createChainRunState, runChain, type RunChainParams } from "./chain";
import { chainKeyFor } from "./chains";
import { ProviderBlockedError, ProviderError, ProviderRateLimitedError } from "./errors";
import type { DailyClose, PriceProvider, ProviderId } from "./types";

function fakeProvider(
  id: ProviderId,
  behaviour: () => Promise<DailyClose[]>,
  extra: Partial<PriceProvider> = {}
): PriceProvider & { calls: number } {
  const provider = {
    id,
    requiredKeyEnv: null,
    maxHistory: "unlimited" as const,
    minDelayMs: 0,
    calls: 0,
    async fetchDailyCloses() {
      provider.calls += 1;
      return behaviour();
    },
    ...extra,
  };
  return provider;
}

const eur = (date: string, close: number): DailyClose => ({ date, close, currency: "EUR" });

function baseParams(providers: Partial<Record<ProviderId, PriceProvider>>, overrides: Partial<RunChainParams> = {}): RunChainParams {
  return {
    instrument: { type: "etf", currency: "EUR" },
    symbols: { yahoo: "VWCE.DE", stooq: "vwce.de", alphavantage: "VWCE.DEX", borsaitaliana: "123" },
    from: "2026-09-20",
    to: "2026-09-27",
    purpose: "daily",
    chain: ["yahoo", "stooq", "alphavantage"],
    providers,
    ctx: { fetch: vi.fn(), env: {} },
    state: createChainRunState(),
    budget: createMemoryBudgetStore(),
    dayKey: "2026-09-27",
    sleep: async () => {},
    ...overrides,
  };
}

describe("runChain", () => {
  it("usa la prima fonte valida e non chiama le successive", async () => {
    const yahoo = fakeProvider("yahoo", async () => [eur("2026-09-26", 100), eur("2026-09-25", 99)]);
    const stooq = fakeProvider("stooq", async () => [eur("2026-09-26", 1)]);
    const result = await runChain(baseParams({ yahoo, stooq }));
    expect(result.source).toBe("yahoo");
    expect(result.closes.map((c) => c.date)).toEqual(["2026-09-25", "2026-09-26"]);
    expect(stooq.calls).toBe(0);
  });

  it("passa alla fonte successiva se la prima fallisce, è vuota o ha la valuta sbagliata", async () => {
    const yahoo = fakeProvider("yahoo", async () => {
      throw new ProviderError("yahoo", "boom");
    });
    const stooq = fakeProvider("stooq", async () => [{ date: "2026-09-26", close: 100, currency: "USD" }]);
    const alphavantage = fakeProvider("alphavantage", async () => [eur("2026-09-26", 100)]);
    const result = await runChain(baseParams({ yahoo, stooq, alphavantage }));
    expect(result.source).toBe("alphavantage");
    expect(result.attempts.map((a) => a.outcome)).toEqual(["error", "currency_mismatch", "success"]);
  });

  it("accetta le chiusure senza valuta dichiarata e scarta quelle non valide o fuori periodo", async () => {
    const yahoo = fakeProvider("yahoo", async () => [
      { date: "2026-09-26", close: 100, currency: null },
      { date: "2026-09-25", close: 0, currency: null },
      { date: "2026-08-01", close: 90, currency: null },
    ]);
    const result = await runChain(baseParams({ yahoo }));
    expect(result.closes).toEqual([{ date: "2026-09-26", close: 100, currency: null }]);
  });

  it("salta in silenzio le fonti senza chiave o senza simbolo", async () => {
    const yahoo = fakeProvider("yahoo", async () => []);
    const stooq = fakeProvider("stooq", async () => [eur("2026-09-26", 100)], { requiredKeyEnv: "STOOQ_API_KEY" });
    const result = await runChain(baseParams({ yahoo, stooq }, { symbols: { stooq: "vwce.de" } }));
    expect(result.source).toBeNull();
    expect(result.attempts).toEqual([
      { provider: "yahoo", outcome: "skipped", reason: "no_symbol" },
      { provider: "stooq", outcome: "skipped", reason: "no_key" },
      { provider: "alphavantage", outcome: "skipped", reason: "no_symbol" },
    ]);
    expect(yahoo.calls + stooq.calls).toBe(0);
  });

  it("apre l'interruttore dopo 3 errori consecutivi e lo mantiene per gli strumenti successivi", async () => {
    const yahoo = fakeProvider("yahoo", async () => {
      throw new ProviderRateLimitedError("yahoo", 429);
    });
    const stooq = fakeProvider("stooq", async () => [eur("2026-09-26", 100)]);
    const state = createChainRunState();
    for (let i = 0; i < 3; i += 1) await runChain(baseParams({ yahoo, stooq }, { state }));
    expect(yahoo.calls).toBe(3);
    const fourth = await runChain(baseParams({ yahoo, stooq }, { state }));
    expect(yahoo.calls).toBe(3);
    expect(fourth.attempts[0]).toEqual({ provider: "yahoo", outcome: "skipped", reason: "circuit_open" });
    expect(fourth.source).toBe("stooq");
  });

  it("un blocco del firewall apre subito l'interruttore", async () => {
    const yahoo = fakeProvider("yahoo", async () => {
      throw new ProviderBlockedError("yahoo", 403);
    });
    const state = createChainRunState();
    await runChain(baseParams({ yahoo }, { state }));
    await runChain(baseParams({ yahoo }, { state }));
    expect(yahoo.calls).toBe(1);
  });

  it("una risposta vuota azzera gli errori consecutivi", async () => {
    let fail = true;
    const yahoo = fakeProvider("yahoo", async () => {
      if (fail) throw new ProviderError("yahoo", "boom");
      return [];
    });
    const state = createChainRunState();
    await runChain(baseParams({ yahoo }, { state }));
    await runChain(baseParams({ yahoo }, { state }));
    fail = false;
    await runChain(baseParams({ yahoo }, { state }));
    fail = true;
    await runChain(baseParams({ yahoo }, { state }));
    expect(state.open.has("yahoo")).toBe(false);
  });

  it("rispetta il budget giornaliero delle fonti a quota", async () => {
    const alphavantage = fakeProvider("alphavantage", async () => [eur("2026-09-26", 100)], { dailyBudget: 2 });
    const budget = createMemoryBudgetStore();
    const params = baseParams({ alphavantage }, { chain: ["alphavantage"], budget });
    await runChain(params);
    await runChain(params);
    const third = await runChain(params);
    expect(alphavantage.calls).toBe(2);
    expect(third.attempts[0].reason).toBe("budget_exhausted");
  });

  it("nel recupero storico salta le fonti con storico limitato", async () => {
    const alphavantage = fakeProvider("alphavantage", async () => [eur("2026-09-26", 100)], { maxHistory: "limited" });
    const result = await runChain(baseParams({ alphavantage }, { chain: ["alphavantage"], purpose: "backfill" }));
    expect(result.attempts[0].reason).toBe("limited_history");
    expect(alphavantage.calls).toBe(0);
  });

  it("segnala come sospetto un salto oltre il 20% da una fonte diversa, ma non per le crypto", async () => {
    const stooq = fakeProvider("stooq", async () => [eur("2026-09-26", 130)]);
    const params = baseParams({ stooq }, { chain: ["stooq"], lastClose: { close: 100, source: "yahoo" } });
    expect((await runChain(params)).suspect).toBe(true);
    expect((await runChain({ ...params, lastClose: { close: 100, source: "stooq" } })).suspect).toBe(false);
    expect((await runChain({ ...params, instrument: { type: "crypto", currency: "EUR" } })).suspect).toBe(false);
  });

  it("aspetta la pausa minima tra due chiamate alla stessa fonte", async () => {
    const sleep = vi.fn(async () => {});
    let clock = 1000;
    const yahoo = fakeProvider("yahoo", async () => [eur("2026-09-26", 100)], { minDelayMs: 500 });
    const state = createChainRunState();
    await runChain(baseParams({ yahoo }, { state, sleep, now: () => clock }));
    clock = 1200;
    await runChain(baseParams({ yahoo }, { state, sleep, now: () => clock }));
    expect(sleep).toHaveBeenCalledWith(300);
  });
});

describe("chainKeyFor", () => {
  it("instrada gli strumenti nella catena giusta", () => {
    expect(chainKeyFor({ type: "azione", currency: "USD" })).toBe("stock_us");
    expect(chainKeyFor({ type: "azione", currency: "EUR" })).toBe("etf_eu");
    expect(chainKeyFor({ type: "etf", currency: "USD" })).toBe("etf_eu");
    expect(chainKeyFor({ type: "obbligazione", currency: "EUR" })).toBe("bond");
    expect(chainKeyFor({ type: "fondo", currency: "EUR" })).toBe("fund");
    expect(chainKeyFor({ type: "crypto", currency: "EUR" })).toBe("crypto");
  });
});
