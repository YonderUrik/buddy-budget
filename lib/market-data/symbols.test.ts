import { describe, expect, it } from "vitest";
import { deriveSymbols, splitYahooSymbol } from "./symbols";

describe("deriveSymbols", () => {
  it("ETF su Xetra: Yahoo, Stooq e Alpha Vantage, niente Borsa Italiana", () => {
    expect(deriveSymbols({ isin: "IE00BK5BQT80", type: "etf", currency: "EUR", yahooSymbol: "VWCE.DE" })).toEqual({
      yahoo: "VWCE.DE",
      stooq: "vwce.de",
      alphavantage: "VWCE.DEX",
    });
  });

  it("ETF su Milano: anche Borsa Italiana su ETFplus", () => {
    expect(deriveSymbols({ isin: "IE00BK5BQT80", type: "etf", currency: "EUR", yahooSymbol: "VWCE.MI" })).toEqual({
      yahoo: "VWCE.MI",
      borsaitaliana: "IE00BK5BQT80,ETFP",
    });
  });

  it("azione USA: Yahoo, Stooq, Alpha Vantage e Twelve Data", () => {
    expect(deriveSymbols({ isin: "US0378331005", type: "azione", currency: "USD", yahooSymbol: "AAPL" })).toEqual({
      yahoo: "AAPL",
      stooq: "aapl.us",
      alphavantage: "AAPL",
      twelvedata: "AAPL",
    });
  });

  it("azione italiana: Borsa Italiana su XMIL", () => {
    expect(deriveSymbols({ isin: "IT0003128367", type: "azione", currency: "EUR", yahooSymbol: "ENEL.MI" }).borsaitaliana).toBe(
      "IT0003128367,XMIL"
    );
  });

  it("BTP senza simbolo Yahoo: solo Borsa Italiana sul MOT", () => {
    expect(deriveSymbols({ isin: "IT0005534984", type: "obbligazione", currency: "EUR" })).toEqual({
      borsaitaliana: "IT0005534984,MOTX",
    });
  });

  it("fondo: solo Yahoo", () => {
    expect(deriveSymbols({ isin: "LU0000000000", type: "fondo", currency: "EUR", yahooSymbol: "0P0000ABCD.F" })).toEqual({
      yahoo: "0P0000ABCD.F",
    });
  });

  it("crypto: CoinGecko con valuta e coppia Kraken", () => {
    expect(deriveSymbols({ isin: null, type: "crypto", currency: "EUR", coingeckoId: "bitcoin" })).toEqual({
      coingecko: "bitcoin:EUR",
      kraken: "XBTEUR",
    });
    expect(deriveSymbols({ isin: null, type: "crypto", currency: "EUR", coingeckoId: "pepe" })).toEqual({ coingecko: "pepe:EUR" });
  });

  it("splitYahooSymbol lascia intere le classi di azioni", () => {
    expect(splitYahooSymbol("BRK-B")).toEqual({ base: "BRK-B", suffix: "" });
    expect(splitYahooSymbol("VWRL.L")).toEqual({ base: "VWRL", suffix: "L" });
  });
});
