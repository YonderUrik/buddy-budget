import { describe, expect, it } from "vitest";
import type { YahooSearchHit } from "@/lib/market-data/providers/yahoo";
import { groupSearchResults, relevantCrypto, type CryptoSearchHit } from "./search-results";

function hit(symbol: string, type: YahooSearchHit["type"]): YahooSearchHit {
  return { symbol, name: symbol, exchange: "X", exchangeLabel: "X", type };
}

function coin(symbol: string, name = symbol): CryptoSearchHit {
  return { id: name.toLowerCase(), name, symbol };
}

describe("relevantCrypto", () => {
  const coins = [coin("BTC", "Bitcoin"), coin("APPL", "Apple Token"), coin("VWX", "Vwce Inu"), coin("APPLE", "AppleSwap")];

  it("con risultati di mercato tiene solo simbolo o nome identici", () => {
    expect(relevantCrypto(coins, "apple", true).map((c) => c.symbol)).toEqual(["APPLE"]);
    expect(relevantCrypto(coins, "vwce", true)).toEqual([]);
  });

  it("senza risultati di mercato tiene anche quelle che iniziano con la ricerca", () => {
    expect(relevantCrypto(coins, "bit", false).map((c) => c.symbol)).toEqual(["BTC"]);
    expect(relevantCrypto(coins, "appl", false).map((c) => c.symbol)).toEqual(["APPL", "APPLE"]);
  });

  it("non supera il massimo", () => {
    const many = Array.from({ length: 12 }, (_, i) => coin(`BTC${i}`));
    expect(relevantCrypto(many, "btc", false)).toHaveLength(5);
  });
});

describe("groupSearchResults", () => {
  it("raggruppa per tipo nell'ordine ETF, azioni, fondi, obbligazioni, ETC, crypto", () => {
    const groups = groupSearchResults(
      [hit("AAPL", "azione"), hit("VWCE.DE", "etf"), hit("0P000", "fondo"), hit("VWCE.MI", "etf")],
      [coin("BTC", "Bitcoin")],
      "bitcoin"
    );
    expect(groups.map((g) => [g.type, g.items.length])).toEqual([
      ["etf", 2],
      ["azione", 1],
      ["fondo", 1],
      ["crypto", 1],
    ]);
  });

  it("scarta le crypto di Yahoo quando CoinGecko ne ha trovate", () => {
    const groups = groupSearchResults([hit("BTC-EUR", "crypto")], [coin("BTC", "Bitcoin")], "btc");
    expect(groups).toHaveLength(1);
    expect(groups[0].items.map((i) => i.source)).toEqual(["coingecko"]);
  });

  it("tiene le crypto di Yahoo se CoinGecko non ha nulla", () => {
    const groups = groupSearchResults([hit("BTC-EUR", "crypto")], [], "btc");
    expect(groups[0].items.map((i) => i.source)).toEqual(["yahoo"]);
  });

  it("nessun gruppo vuoto", () => {
    expect(groupSearchResults([], [coin("DOGE")], "vwce")).toEqual([]);
  });
});
