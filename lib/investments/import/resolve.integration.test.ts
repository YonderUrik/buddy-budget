import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { client, db } from "@/lib/db/client";
import { instruments } from "@/lib/db/schema/investments";
import { authUser } from "@/lib/db/schema/auth";
import { randomUUID } from "node:crypto";
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

  it("negli strumenti del rendiconto collega la quotazione trovata, altrimenti resta manuale", async () => {
    const fromStatement = { ...identity, name: "ISHARES CORE MSCI WORLD" };
    const linked = await resolveIdentity("test-user", fromStatement, deps({ searchByIsin: async () => ({ status: "ok", hits: [HIT] }) }));
    expect(linked).toMatchObject({ kind: "proposal", input: { source: "yahoo", yahooSymbol: "SWDA.MI", isin: "IE00B4L5Y983" }, confidence: "guess" });
    for (const status of ["empty", "unavailable"] as const) {
      const manual = await resolveIdentity("test-user", fromStatement, deps({ searchByIsin: async () => ({ status, hits: [] }) }));
      expect(manual).toMatchObject({ kind: "proposal", input: { source: "manuale" }, confidence: "exact" });
    }
    const throwing = await resolveIdentity("test-user", fromStatement, deps({ searchByIsin: async () => { throw new Error("boom"); } }));
    expect(throwing).toMatchObject({ input: { source: "manuale" } });
  });

  it("se l'ISIN esiste già come strumento comune in un'altra valuta non collega la quotazione: resta manuale nella valuta del file", async () => {
    const tesla = { ...identity, isin: "US88160R1014", name: "Tesla", currency: "EUR" };
    const [usd] = await db.insert(instruments).values({ isin: tesla.isin, name: "Tesla", type: "azione", currency: "USD" }).returning();
    try {
      const match = await resolveIdentity("test-user", tesla, deps({ searchByIsin: async () => ({ status: "ok", hits: [{ ...HIT, symbol: "TL0.DE" }] }) }));
      expect(match).toMatchObject({ kind: "proposal", input: { source: "manuale", currency: "EUR" } });
    } finally {
      await db.delete(instruments).where(eq(instruments.id, usd.id));
    }
  });

  it("passes the exchange the broker reports to the ISIN search", async () => {
    let asked: string | null | undefined;
    const intel = { ...identity, isin: "US4581401001", name: "INTEL CORP", currency: "USD", exchange: "US" };
    const match = await resolveIdentity("test-user", intel, deps({ searchByIsin: async (_isin, _currency, exchange) => { asked = exchange; return { status: "ok", hits: [{ ...HIT, symbol: "INTC" }] }; } }));
    expect(asked).toBe("US");
    expect(match).toMatchObject({ kind: "proposal", input: { source: "yahoo", yahooSymbol: "INTC" } });
  });

  it("a corporate action keeps the broker's prices on the user's own copy, which later statements reuse", async () => {
    const userId = randomUUID();
    await db.insert(authUser).values({ id: userId, name: "Corporate action", email: `${userId}@example.test` });
    const liberty = { ...identity, isin: "BMG611881019", name: "LIBERTY GLOBAL LTD-A", currency: "USD" };
    try {
      const searched: string[] = [];
      const first = await resolveIdentity(userId, { ...liberty, corporateAction: true }, deps({ searchByIsin: async (isin) => { searched.push(isin); return { status: "ok", hits: [{ ...HIT, symbol: "LBTYA" }] }; } }));
      expect(first).toMatchObject({ kind: "proposal", input: { source: "manuale", ownCopy: true, isin: liberty.isin, currency: "USD" } });
      expect(searched).toEqual([]);
      const [own] = await db.insert(instruments).values({ isin: liberty.isin, name: liberty.name, type: "azione", currency: "USD", priceMode: "manuale", createdByUserId: userId }).returning();
      const later = await resolveIdentity(userId, liberty, deps({ searchByIsin: async () => ({ status: "ok", hits: [{ ...HIT, symbol: "LBTYA" }] }) }));
      expect(later).toMatchObject({ kind: "known", instrument: { id: own.id } });
    } finally {
      await db.delete(instruments).where(eq(instruments.createdByUserId, userId));
      await db.delete(authUser).where(eq(authUser.id, userId));
    }
  });
});
