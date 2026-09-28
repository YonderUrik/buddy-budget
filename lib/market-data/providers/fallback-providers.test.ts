import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderBlockedError, ProviderRateLimitedError } from "../errors";
import type { ProviderContext } from "../types";
import { alphaVantageProvider } from "./alphavantage";
import { borsaItalianaPeriod, borsaItalianaProvider, resetBorsaItalianaSession } from "./borsaitaliana";
import { stooqProvider } from "./stooq";
import { fakeContext, readFixture } from "./test-utils";
import { twelveDataProvider } from "./twelvedata";

describe("stooq", () => {
  it("legge il CSV e passa la chiave", async () => {
    const ctx = fakeContext(readFixture("synthetic-stooq.csv"), 200, { STOOQ_API_KEY: "abc" });
    const closes = await stooqProvider.fetchDailyCloses("vwce.de", "2026-09-24", "2026-09-25", ctx);
    expect(closes).toEqual([
      { date: "2026-09-24", close: 140.02, currency: null },
      { date: "2026-09-25", close: 140.88, currency: null },
    ]);
    expect(ctx.urls[0]).toContain("s=vwce.de&d1=20260924&d2=20260925&i=d&apikey=abc");
  });

  it("la richiesta di apikey è un blocco, 'No data' è vuoto", async () => {
    await expect(
      stooqProvider.fetchDailyCloses("vwce.de", "2026-09-24", "2026-09-25", fakeContext(readFixture("synthetic-stooq-apikey.txt")))
    ).rejects.toBeInstanceOf(ProviderBlockedError);
    expect(await stooqProvider.fetchDailyCloses("x", "2026-09-24", "2026-09-25", fakeContext("No data"))).toEqual([]);
  });
});

describe("alpha vantage", () => {
  it("legge la serie giornaliera", async () => {
    const closes = await alphaVantageProvider.fetchDailyCloses(
      "VWCE.DEX",
      "2026-09-24",
      "2026-09-25",
      fakeContext(readFixture("synthetic-alphavantage-daily.json"))
    );
    expect(closes).toContainEqual({ date: "2026-09-25", close: 140.88, currency: null });
  });

  it("riconosce la quota esaurita anche con status 200", async () => {
    await expect(
      alphaVantageProvider.fetchDailyCloses("X", "2026-09-24", "2026-09-25", fakeContext(readFixture("synthetic-alphavantage-limit.json")))
    ).rejects.toBeInstanceOf(ProviderRateLimitedError);
  });

  it("un simbolo non valido è una risposta vuota", async () => {
    const ctx = fakeContext('{"Error Message":"Invalid API call."}');
    expect(await alphaVantageProvider.fetchDailyCloses("X", "2026-09-24", "2026-09-25", ctx)).toEqual([]);
  });
});

describe("twelve data", () => {
  it("legge la serie con la valuta dichiarata", async () => {
    const closes = await twelveDataProvider.fetchDailyCloses(
      "AAPL",
      "2026-09-24",
      "2026-09-25",
      fakeContext(readFixture("synthetic-twelvedata.json"))
    );
    expect(closes).toContainEqual({ date: "2026-09-25", close: 251.3, currency: "USD" });
  });

  it("gli errori con status 200 diventano errori tipizzati o vuoti", async () => {
    await expect(
      twelveDataProvider.fetchDailyCloses("AAPL", "2026-09-24", "2026-09-25", fakeContext(readFixture("synthetic-twelvedata-limit.json")))
    ).rejects.toBeInstanceOf(ProviderRateLimitedError);
    const notFound = fakeContext('{"code":404,"message":"symbol not found","status":"error"}');
    expect(await twelveDataProvider.fetchDailyCloses("X", "2026-09-24", "2026-09-25", notFound)).toEqual([]);
  });
});

describe("borsa italiana", () => {
  beforeEach(() => resetBorsaItalianaSession());

  function borsaContext(page: string, history: string, historyStatus = 200): ProviderContext & { requests: { url: string; headers: Record<string, string> }[] } {
    const requests: { url: string; headers: Record<string, string> }[] = [];
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
      if (url.includes("/interactive-chart/")) {
        const headers = new Headers();
        headers.append("Set-Cookie", "visid_incap=abc; path=/; HttpOnly");
        headers.append("Set-Cookie", "incap_ses=def; path=/");
        return new Response(page, { status: 200, headers });
      }
      return new Response(history, { status: historyStatus });
    }) as unknown as typeof globalThis.fetch;
    return { fetch, env: {}, requests };
  }

  it("prende il token dalla pagina e lo usa con i cookie del firewall", async () => {
    const ctx = borsaContext(readFixture("synthetic-borsaitaliana-page.html"), readFixture("synthetic-borsaitaliana-history.json"));
    const closes = await borsaItalianaProvider.fetchDailyCloses("IT0005534984,MOTX", "2026-09-24", "2026-09-26", ctx);
    expect(closes).toEqual([
      { date: "2026-09-24", close: 100.25, currency: "EUR" },
      { date: "2026-09-25", close: 100.31, currency: "EUR" },
    ]);
    expect(ctx.requests[0].url).toContain("/interactive-chart/IT0005534984-MOTX");
    const api = ctx.requests[1];
    expect(api.url).toContain("/api/instruments/IT0005534984%2CMOTX%2CISIN/history/period?period=");
    expect(api.headers.Authorization).toBe("Bearer eyJhbGciOiJIUzI1NiJ9.eyJhbm9uIjp0cnVlfQ.sig");
    expect(api.headers.Cookie).toBe("visid_incap=abc; incap_ses=def");
  });

  it("riusa il token per le chiamate successive", async () => {
    const ctx = borsaContext(readFixture("synthetic-borsaitaliana-page.html"), readFixture("synthetic-borsaitaliana-history.json"));
    await borsaItalianaProvider.fetchDailyCloses("IT0005534984,MOTX", "2026-09-24", "2026-09-26", ctx);
    await borsaItalianaProvider.fetchDailyCloses("IT0005534984,MOTX", "2026-09-24", "2026-09-26", ctx);
    expect(ctx.requests.filter((r) => r.url.includes("interactive-chart"))).toHaveLength(1);
  });

  it("una pagina senza token (sfida del firewall) è un blocco", async () => {
    const ctx = borsaContext("<html>Request unsuccessful. Incapsula incident ID</html>", "{}");
    await expect(
      borsaItalianaProvider.fetchDailyCloses("IT0005534984,MOTX", "2026-09-24", "2026-09-26", ctx)
    ).rejects.toBeInstanceOf(ProviderBlockedError);
  });

  it("un 401 sull'API butta il token in cache", async () => {
    const ctx = borsaContext(readFixture("synthetic-borsaitaliana-page.html"), "", 401);
    await expect(
      borsaItalianaProvider.fetchDailyCloses("IT0005534984,MOTX", "2026-09-24", "2026-09-26", ctx)
    ).rejects.toBeInstanceOf(ProviderBlockedError);
    await expect(borsaItalianaProvider.fetchDailyCloses("IT0005534984,MOTX", "2026-09-24", "2026-09-26", ctx)).rejects.toThrow();
    expect(ctx.requests.filter((r) => r.url.includes("interactive-chart"))).toHaveLength(2);
  });

  it("sceglie il periodo più corto che copre l'intervallo", () => {
    const now = Date.parse("2026-09-28T12:00:00Z");
    expect(borsaItalianaPeriod("2026-09-21", now)).toBe("1M");
    expect(borsaItalianaPeriod("2026-05-01", now)).toBe("6M");
    expect(borsaItalianaPeriod("2020-01-01", now)).toBe("MAX");
  });
});
