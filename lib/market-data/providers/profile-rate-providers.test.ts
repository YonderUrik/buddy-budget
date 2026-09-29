import { beforeEach, describe, expect, it } from "vitest";
import { estrProvider, parseEstrCsv } from "./estr";
import { fakeContext, readFixture } from "./test-utils";
import { fetchYahooProfile, resetYahooSession } from "./yahoo";

describe("yahoo quoteSummary", () => {
  beforeEach(() => resetYahooSession());

  it("legge settori, mix di attività e primi titoli di un ETF nelle chiavi dell'app", async () => {
    const ctx = fakeContext(readFixture("synthetic-yahoo-quotesummary-fund.json"));
    const profile = await fetchYahooProfile("VWCE.DE", "fund", ctx);
    expect(profile).toEqual({
      sectors: { immobiliare: 0.0215, tecnologia: 0.2601, finanza: 0.1612 },
      assetMix: { stock: 0.9961, bond: 0, cash: 0.0039, other: 0 },
      holdings: [
        { symbol: "NVDA", name: "NVIDIA Corp", weight: 0.0481 },
        { symbol: "AAPL", name: "Apple Inc", weight: 0.0423 },
        { symbol: null, name: "Senza simbolo SpA", weight: 0.01 },
      ],
      sector: null,
      country: null,
    });
    expect(ctx.urls.some((u) => u.includes("/v10/finance/quoteSummary/VWCE.DE?modules=topHoldings"))).toBe(true);
  });

  it("legge settore e paese di un'azienda", async () => {
    const ctx = fakeContext(readFixture("synthetic-yahoo-quotesummary-company.json"));
    expect(await fetchYahooProfile("AAPL", "company", ctx)).toMatchObject({ sector: "tecnologia", country: "US", sectors: null, holdings: null });
    expect(ctx.urls.some((u) => u.includes("modules=assetProfile"))).toBe(true);
  });

  it("uno strumento senza dati è null, non un errore", async () => {
    expect(await fetchYahooProfile("NOPE", "fund", fakeContext('{"quoteSummary":{"result":null,"error":{"code":"Not Found"}}}', 404))).toBeNull();
  });
});

describe("€STR BCE", () => {
  it("converte il CSV in tassi come frazione, saltando i giorni senza valore", async () => {
    const ctx = fakeContext(readFixture("synthetic-ecb-estr.csv"));
    expect(await estrProvider.fetchDailyRates("2026-09-24", "2026-09-28", ctx)).toEqual([
      { date: "2026-09-24", rate: 0.01918 },
      { date: "2026-09-25", rate: 0.01921 },
    ]);
    expect(ctx.urls[0]).toContain("/service/data/EST/B.EU000A2X2A25.WT?startPeriod=2026-09-24&endPeriod=2026-09-28&format=csvdata");
  });

  it("un'intestazione inattesa è un errore della fonte", () => {
    expect(() => parseEstrCsv("A,B\n1,2")).toThrow();
  });
});
