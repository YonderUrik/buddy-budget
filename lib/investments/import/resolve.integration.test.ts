import { afterAll, describe, expect, it } from "vitest";
import { client } from "@/lib/db/client";
import { resolveIdentity, type ResolveDeps } from "./resolve";

const identity = { key: "k1", symbol: null, isin: "IE00B4L5Y983", name: null, currency: "EUR", symbolIsYahoo: false } as const;
const HIT = { symbol: "SWDA.MI", name: "ISHARES CORE MSCI WORLD", exchange: "MIL", exchangeLabel: "Milan", type: "etf" } as const;

function deps(overrides: Partial<ResolveDeps>): ResolveDeps {
  return { searchMarket: async () => [], searchCrypto: async () => [], ...overrides };
}

describe("resolveIdentity: ripiego OpenFIGI per gli ISIN", () => {
  afterAll(async () => {
    await client.end();
  });

  it("propone la quotazione trovata dall'ISIN quando Yahoo non la trova, da controllare", async () => {
    const match = await resolveIdentity("test-user", identity, deps({ searchByIsin: async () => ({ status: "ok", hits: [HIT] }) }));
    expect(match).toMatchObject({
      kind: "proposal",
      confidence: "guess",
      type: "etf",
      input: { source: "yahoo", yahooSymbol: "SWDA.MI", isin: "IE00B4L5Y983" },
    });
  });

  it("senza ripiego o senza risultati resta da cercare a mano", async () => {
    expect(await resolveIdentity("test-user", identity, deps({}))).toEqual({ kind: "none", reason: "not_found" });
    expect(await resolveIdentity("test-user", identity, deps({ searchByIsin: async () => ({ status: "empty", hits: [] }) }))).toEqual({ kind: "none", reason: "not_found" });
  });

  it("dice che la fonte non risponde invece di 'non trovato'", async () => {
    const down = deps({ searchByIsin: async () => ({ status: "unavailable", hits: [] }) });
    expect(await resolveIdentity("test-user", identity, down)).toEqual({ kind: "none", reason: "unavailable" });
    const yahooDown = deps({ searchMarket: async () => { throw new Error("429"); }, searchByIsin: async () => ({ status: "unavailable", hits: [] }) });
    expect(await resolveIdentity("test-user", identity, yahooDown)).toEqual({ kind: "none", reason: "unavailable" });
  });

  it("un ISIN che Yahoo trova da solo non passa da OpenFIGI", async () => {
    let called = false;
    const match = await resolveIdentity("test-user", identity, deps({ searchMarket: async () => [HIT], searchByIsin: async () => { called = true; return { status: "ok", hits: [] }; } }));
    expect(match.kind).toBe("proposal");
    expect(called).toBe(false);
  });
});
