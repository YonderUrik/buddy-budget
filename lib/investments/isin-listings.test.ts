import { describe, expect, it, vi } from "vitest";
import { instrumentTypeFromFigi, searchByIsinOnOpenFigi, verifyIsinListings, type IsinListingsDeps } from "./isin-listings";

const listing = (yahooSymbol: string, name: string | null = null, securityType: string | null = null) => ({ yahooSymbol, exchCode: "IM", name, securityType });

function deps(meta: Record<string, string>, symbols = Object.keys(meta)): IsinListingsDeps {
  return {
    listings: vi.fn(async () => symbols.map((s) => listing(s, "ISHARES CORE MSCI WORLD", "Mutual Fund"))),
    quoteMeta: vi.fn(async (symbol: string) => (symbol in meta ? { currency: meta[symbol], exchange: "Milan" } : null)),
  };
}

describe("verifyIsinListings", () => {
  it("senza valuta tiene tutte le quotazioni che esistono su Yahoo", async () => {
    const result = await verifyIsinListings("IE00B4L5Y983", null, deps({ "SWDA.MI": "EUR", "SWDA.L": "GBP" }, ["SWDA.MI", "SWDA.L", "NOPE.DE"]));
    expect(result.status === "ok" && result.listings.map((l) => l.listing.yahooSymbol)).toEqual(["SWDA.MI", "SWDA.L"]);
  });

  it("con la valuta del file tiene solo quelle nella stessa valuta", async () => {
    const result = await verifyIsinListings("IE00B4L5Y983", "EUR", deps({ "SWDA.MI": "EUR", "SWDA.L": "GBP" }));
    expect(result.status === "ok" && result.listings.map((l) => l.listing.yahooSymbol)).toEqual(["SWDA.MI"]);
  });

  it("distingue il nulla trovato dalla fonte che non risponde", async () => {
    expect(await verifyIsinListings("IE00B4L5Y983", "USD", deps({ "SWDA.MI": "EUR" }))).toEqual({ status: "empty" });
    const down: IsinListingsDeps = { listings: async () => { throw new Error("x"); }, quoteMeta: async () => null };
    expect(await verifyIsinListings("IE00B4L5Y983", null, down)).toEqual({ status: "unavailable" });
  });
});

describe("searchByIsinOnOpenFigi", () => {
  it("restituisce risultati nello stile della ricerca Yahoo, con nome e tipo di OpenFIGI", async () => {
    const result = await searchByIsinOnOpenFigi("IE00B4L5Y983", "EUR", deps({ "SWDA.MI": "EUR" }));
    expect(result.hits).toEqual([{ symbol: "SWDA.MI", name: "ISHARES CORE MSCI WORLD", exchange: "Milan", exchangeLabel: "Milan", type: "etf" }]);
  });
});

describe("instrumentTypeFromFigi", () => {
  it("ricava il tipo dal tipo e dal nome di OpenFIGI", () => {
    expect(instrumentTypeFromFigi({ name: "ADOBE INC", securityType: "Common Stock" })).toBe("azione");
    expect(instrumentTypeFromFigi({ name: "ISHARES CORE MSCI WORLD", securityType: "Mutual Fund" })).toBe("etf");
    expect(instrumentTypeFromFigi({ name: "WISDOMTREE PHYSICAL GOLD", securityType: "ETP" })).toBe("etf");
    expect(instrumentTypeFromFigi({ name: "SOME FUND", securityType: "Open-End Fund" })).toBe("fondo");
    expect(instrumentTypeFromFigi({ name: null, securityType: null })).toBe("azione");
  });
});
