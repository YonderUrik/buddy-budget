import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderBlockedError, ProviderError, ProviderRateLimitedError } from "../errors";
import { coinGeckoProvider } from "./coingecko";
import { ecbProvider } from "./ecb";
import { frankfurterProvider } from "./frankfurter";
import { krakenProvider } from "./kraken";
import { fakeContext, readFixture } from "./test-utils";
import type { ProviderContext } from "../types";
import { fetchYahooQuoteMeta, resetYahooSession, searchYahoo, yahooProvider } from "./yahoo";

describe("yahoo", () => {
  beforeEach(() => resetYahooSession());

  it("legge le chiusure giornaliere saltando i giorni senza prezzo", async () => {
    const ctx = fakeContext(readFixture("synthetic-yahoo-chart.json"));
    const closes = await yahooProvider.fetchDailyCloses("VWCE.DE", "2025-09-20", "2025-09-30", ctx);
    expect(closes).toEqual([
      { date: "2025-09-25", close: 140.12, currency: "EUR" },
      { date: "2025-09-27", close: 141.5, currency: "EUR" },
    ]);
    expect(ctx.urls.some((u) => u.includes("/v8/finance/chart/VWCE.DE?period1="))).toBe(true);
  });

  it("converte i pence in sterline", async () => {
    const closes = await yahooProvider.fetchDailyCloses(
      "VWRL.L",
      "2025-09-20",
      "2025-09-30",
      fakeContext(readFixture("synthetic-yahoo-chart-gbp.json"))
    );
    expect(closes).toEqual([{ date: "2025-09-25", close: 102.5, currency: "GBP" }]);
  });

  it("uno strumento sconosciuto è una risposta vuota, non un errore", async () => {
    const ctx = fakeContext('{"chart":{"result":null,"error":{"code":"Not Found"}}}', 404);
    expect(await yahooProvider.fetchDailyCloses("NOPE", "2025-09-20", "2025-09-30", ctx)).toEqual([]);
  });

  it("429 e 403 diventano errori tipizzati per l'interruttore", async () => {
    await expect(yahooProvider.fetchDailyCloses("X", "2025-09-20", "2025-09-30", fakeContext("", 429))).rejects.toBeInstanceOf(
      ProviderRateLimitedError
    );
    await expect(yahooProvider.fetchDailyCloses("X", "2025-09-20", "2025-09-30", fakeContext("", 403))).rejects.toBeInstanceOf(
      ProviderBlockedError
    );
  });

  it("una pagina HTML al posto del JSON è un errore della fonte", async () => {
    await expect(
      yahooProvider.fetchDailyCloses("X", "2025-09-20", "2025-09-30", fakeContext("<html>captcha</html>"))
    ).rejects.toBeInstanceOf(ProviderError);
  });

  it("la ricerca tiene solo i tipi gestiti", async () => {
    const hits = await searchYahoo("IE00BK5BQT80", fakeContext(readFixture("synthetic-yahoo-search.json")));
    expect(hits.map((h) => [h.symbol, h.type, h.exchange])).toEqual([
      ["VWCE.DE", "etf", "GER"],
      ["VWCE.MI", "etf", "MIL"],
    ]);
    expect(hits[0].name).toBe("Vanguard FTSE All-World UCITS ETF USD Accumulation");
  });

  /** Yahoo finto: `fc.yahoo.com` imposta il cookie, `getcrumb` dà il crumb, il resto risponde con `answer`. */
  function yahooSessionContext(answer: (url: string, cookie: string | null) => Response) {
    const calls: { url: string; cookie: string | null }[] = [];
    let crumbCount = 0;
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const cookie = (init?.headers as Record<string, string> | undefined)?.Cookie ?? null;
      calls.push({ url, cookie });
      if (url.startsWith("https://fc.yahoo.com")) {
        return new Response("", { status: 404, headers: { "Set-Cookie": "A3=abc123; Domain=.yahoo.com; Path=/; Secure" } });
      }
      if (url.includes("/getcrumb")) return new Response(`crumb${++crumbCount}`);
      return answer(url, cookie);
    }) as unknown as typeof globalThis.fetch;
    const ctx: ProviderContext = { fetch, env: {} };
    return { ctx, calls };
  }

  it("usa cookie e crumb della sessione, presi una volta sola", async () => {
    const search = readFixture("synthetic-yahoo-search.json");
    const { ctx, calls } = yahooSessionContext(() => new Response(search));
    await searchYahoo("VWCE", ctx);
    await searchYahoo("SWDA", ctx);
    const searches = calls.filter((c) => c.url.includes("/v1/finance/search"));
    expect(searches).toHaveLength(2);
    expect(searches.every((c) => c.cookie === "A3=abc123" && c.url.includes("&crumb=crumb1"))).toBe(true);
    expect(calls.filter((c) => c.url.startsWith("https://fc.yahoo.com"))).toHaveLength(1);
  });

  it("se Yahoo rifiuta una sessione vecchia ne prende una nuova e riprova una volta", async () => {
    const search = readFixture("synthetic-yahoo-search.json");
    const { ctx, calls } = yahooSessionContext((url) =>
      url.includes("crumb=crumb1") && url.includes("q=SWDA") ? new Response("", { status: 429 }) : new Response(search)
    );
    await searchYahoo("VWCE", ctx);
    const hits = await searchYahoo("SWDA", ctx);
    expect(hits).toHaveLength(2);
    expect(calls.filter((c) => c.url.includes("q=SWDA")).map((c) => c.url.match(/crumb=(\w+)/)?.[1])).toEqual(["crumb1", "crumb2"]);
  });

  it("una sessione appena creata e rifiutata non si riprova all'infinito", async () => {
    const { ctx, calls } = yahooSessionContext(() => new Response("", { status: 429 }));
    await expect(searchYahoo("VWCE", ctx)).rejects.toBeInstanceOf(ProviderRateLimitedError);
    expect(calls.filter((c) => c.url.includes("/v1/finance/search"))).toHaveLength(1);
  });

  it("senza cookie da Yahoo si procede senza sessione", async () => {
    const ctx = fakeContext(readFixture("synthetic-yahoo-search.json"));
    const hits = await searchYahoo("VWCE", ctx);
    expect(hits).toHaveLength(2);
    expect(ctx.urls.find((u) => u.includes("/v1/finance/search"))).not.toContain("crumb=");
  });

  it("legge valuta e borsa di una quotazione", async () => {
    const meta = await fetchYahooQuoteMeta("VWRL.L", fakeContext(readFixture("synthetic-yahoo-chart-gbp.json")));
    expect(meta).toEqual({ currency: "GBP", exchange: "LSE" });
  });
});

describe("cambi", () => {
  it("BCE: legge il CSV per nome di colonna e salta le osservazioni mancanti", async () => {
    const ctx = fakeContext(readFixture("synthetic-ecb.csv"));
    const rates = await ecbProvider.fetchRates(["USD", "GBP", "EUR"], "2026-09-24", "2026-09-26", ctx);
    expect(rates).toEqual([
      { date: "2026-09-24", currency: "USD", perEur: 1.1712 },
      { date: "2026-09-25", currency: "USD", perEur: 1.1698 },
      { date: "2026-09-25", currency: "GBP", perEur: 0.8712 },
    ]);
    expect(ctx.urls[0]).toContain("EXR/D.USD+GBP.EUR.SP00.A?");
  });

  it("BCE: senza valute diverse dall'EUR non chiama nulla", async () => {
    const ctx = fakeContext("");
    expect(await ecbProvider.fetchRates(["EUR"], "2026-09-24", "2026-09-26", ctx)).toEqual([]);
    expect(ctx.urls).toHaveLength(0);
  });

  it("Frankfurter: legge l'intervallo", async () => {
    const rates = await frankfurterProvider.fetchRates(
      ["USD", "GBP"],
      "2026-09-24",
      "2026-09-25",
      fakeContext(readFixture("synthetic-frankfurter.json"))
    );
    expect(rates).toHaveLength(4);
    expect(rates).toContainEqual({ date: "2026-09-25", currency: "GBP", perEur: 0.8712 });
  });
});

describe("crypto", () => {
  it("CoinGecko: un prezzo per giorno UTC, l'ultimo del giorno", async () => {
    const ctx = fakeContext(readFixture("synthetic-coingecko-chart.json"), 200, { COINGECKO_API_KEY: "k" });
    const closes = await coinGeckoProvider.fetchDailyCloses("bitcoin:EUR", "2025-09-25", "2025-09-26", ctx);
    expect(closes).toEqual([
      { date: "2025-09-25", close: 95500.25, currency: "EUR" },
      { date: "2025-09-26", close: 96000.75, currency: "EUR" },
    ]);
    expect(ctx.urls[0]).toContain("coins/bitcoin/market_chart/range?vs_currency=eur");
  });

  it("CoinGecko: rifiuta un simbolo senza valuta", async () => {
    await expect(coinGeckoProvider.fetchDailyCloses("bitcoin", "2025-09-25", "2025-09-26", fakeContext("{}"))).rejects.toThrow();
  });

  it("Kraken: legge l'OHLC giornaliero e tratta la coppia sconosciuta come vuota", async () => {
    const closes = await krakenProvider.fetchDailyCloses(
      "XBTEUR",
      "2025-09-25",
      "2025-09-26",
      fakeContext(readFixture("synthetic-kraken-ohlc.json"))
    );
    expect(closes).toEqual([
      { date: "2025-09-25", close: 95500.1, currency: null },
      { date: "2025-09-26", close: 96100.2, currency: null },
    ]);
    const unknown = fakeContext('{"error":["EQuery:Unknown asset pair"]}');
    expect(await krakenProvider.fetchDailyCloses("NOPE", "2025-09-25", "2025-09-26", unknown)).toEqual([]);
  });
});
