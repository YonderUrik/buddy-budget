import { NextRequest, after } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { instrumentPrices, instrumentSymbols, instruments, userInstrumentPrices } from "@/lib/db/schema/investments";
import { redis } from "@/lib/redis/client";

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: vi.fn() };
});
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

import { auth } from "@/lib/auth";
import { POST as createInstrument } from "./route";
import { GET as search } from "./search/route";
import { PATCH as renameInstrument } from "./[id]/route";
import { POST as addManualPrice, DELETE as deleteManualPrice } from "./[id]/manual-prices/route";
import { GET as backfillStatus } from "./backfill/route";

const mockedGetSession = vi.mocked(auth.api.getSession);
const afterTasks: Promise<unknown>[] = [];

/** ISIN valido e unico per esecuzione: il DB di sviluppo può già contenere gli strumenti veri (condivisi tra utenti). */
function uniqueIsin(country: string): string {
  const body = `${country}${crypto.randomUUID().replace(/-/g, "").slice(0, 9).toUpperCase()}`;
  const digits = [...body].map((c) => (/\d/.test(c) ? c : String(c.charCodeAt(0) - 55))).join("");
  let sum = 0;
  let double = true;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return `${body}${(10 - (sum % 10)) % 10}`;
}

/** Ticker unico per esecuzione (le fonti finte accettano qualunque simbolo). */
function uniqueTicker(): string {
  return `BBT${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

function post(body: unknown) {
  return new NextRequest("http://localhost/api/instruments", { method: "POST", body: JSON.stringify(body) });
}

describe("API strumenti", () => {
  const userIds: string[] = [];
  const createdInstrumentIds: string[] = [];
  let userId: string;

  async function createUser() {
    const [user] = await db
      .insert(authUser)
      .values({
        id: `test-instruments-${crypto.randomUUID()}`,
        name: "Test",
        email: `test-instruments-${crypto.randomUUID()}@example.com`,
        emailVerified: false,
      })
      .returning();
    userIds.push(user.id);
    return user.id;
  }

  function as(id: string) {
    mockedGetSession.mockResolvedValue({ user: { id } } as never);
  }

  async function createAndTrack(body: unknown) {
    const response = await createInstrument(post(body));
    const json = await response.json();
    // Solo gli strumenti creati qui: uno riusato può appartenere ad altri dati del DB.
    if (response.status === 201 && json.id) createdInstrumentIds.push(json.id);
    return { response, json };
  }

  beforeAll(() => {
    process.env.MARKET_DATA_FAKE = "1";
  });

  beforeEach(async () => {
    userId = await createUser();
    as(userId);
    afterTasks.length = 0;
    vi.mocked(after).mockImplementation((task) => {
      afterTasks.push(Promise.resolve(typeof task === "function" ? task() : task));
    });
  });

  afterEach(async () => {
    await Promise.all(afterTasks);
    if (createdInstrumentIds.length > 0) {
      await redis.del(...createdInstrumentIds.map((id) => `market:backfill:${id}`));
      await db.delete(instruments).where(inArray(instruments.id, createdInstrumentIds));
    }
    createdInstrumentIds.length = 0;
    await db.delete(authUser).where(inArray(authUser.id, userIds));
    userIds.length = 0;
  });

  afterAll(async () => {
    delete process.env.MARKET_DATA_FAKE;
    redis.disconnect();
    await client.end();
  });

  it("risponde 401 senza sessione", async () => {
    mockedGetSession.mockResolvedValueOnce(null as never);
    expect((await createInstrument(post({}))).status).toBe(401);
  });

  it("crea uno strumento da Yahoo con valuta letta dal server, simboli derivati e storico recuperato in background", async () => {
    const ticker = uniqueTicker();
    const { response, json } = await createAndTrack({ source: "yahoo", yahooSymbol: `${ticker}.DE`, name: ticker, type: "etf", isin: uniqueIsin("IE") });
    expect(response.status).toBe(201);
    expect([json.currency, json.exchange, json.createdByUserId, json.priceMode]).toEqual(["EUR", "GER", null, "auto"]);
    const symbols = await db.select().from(instrumentSymbols).where(eq(instrumentSymbols.instrumentId, json.id));
    expect(symbols.map((s) => [s.provider, s.symbol]).sort()).toEqual([
      ["alphavantage", `${ticker}.DEX`],
      ["stooq", `${ticker.toLowerCase()}.de`],
      ["yahoo", `${ticker}.DE`],
    ]);
    await Promise.all(afterTasks);
    const prices = await db.select().from(instrumentPrices).where(eq(instrumentPrices.instrumentId, json.id));
    expect(prices.length).toBeGreaterThan(10);
    const statusResponse = await backfillStatus(new NextRequest(`http://localhost/api/instruments/backfill?ids=${json.id}`));
    const [status] = await statusResponse.json();
    expect([status.status, status.saved]).toEqual(["done", prices.length]);
  });

  it("riusa lo strumento esistente con lo stesso ISIN o lo stesso simbolo", async () => {
    const ticker = uniqueTicker();
    const isin = uniqueIsin("IE");
    const first = await createAndTrack({ source: "yahoo", yahooSymbol: `${ticker}.DE`, name: ticker, type: "etf", isin });
    const sameIsin = await createAndTrack({ source: "yahoo", yahooSymbol: `${ticker}.MI`, name: "Altro nome", type: "etf", isin });
    const sameSymbol = await createAndTrack({ source: "yahoo", yahooSymbol: `${ticker}.DE`, name: "Altro", type: "etf" });
    expect(sameIsin.response.status).toBe(200);
    expect(sameIsin.json.id).toBe(first.json.id);
    expect(sameSymbol.json.id).toBe(first.json.id);
  });

  it("gli strumenti manuali sono visibili solo a chi li crea", async () => {
    const { json } = await createAndTrack({ source: "manuale", name: "Fondo pensione aperto", type: "fondo", currency: "EUR" });
    expect([json.priceMode, json.createdByUserId]).toEqual(["manuale", userId]);

    const mine = await (await search(new NextRequest("http://localhost/api/instruments/search?q=pensione"))).json();
    expect(mine.known.map((i: { id: string }) => i.id)).toContain(json.id);

    as(await createUser());
    const theirs = await (await search(new NextRequest("http://localhost/api/instruments/search?q=pensione"))).json();
    expect(theirs.known.map((i: { id: string }) => i.id)).not.toContain(json.id);
    const price = await addManualPrice(
      new NextRequest(`http://localhost/api/instruments/${json.id}/manual-prices`, { method: "POST", body: JSON.stringify({ date: "2026-09-25", close: 10 }) }),
      { params: Promise.resolve({ id: json.id }) }
    );
    expect(price.status).toBe(404);
  });

  it("la creazione solo-ISIN vale per le obbligazioni, non per un'azione", async () => {
    const bondIsin = uniqueIsin("IT");
    const bond = await createAndTrack({ source: "isin", isin: bondIsin, name: "Titolo", type: "obbligazione", currency: "EUR" });
    expect(bond.response.status).toBe(201);
    expect(bond.json.priceUnit).toBe("percentuale_nominale");
    await Promise.all(afterTasks);
    await db.delete(instruments).where(eq(instruments.id, bond.json.id));
    createdInstrumentIds.splice(createdInstrumentIds.indexOf(bond.json.id), 1);
    const stock = await createAndTrack({ source: "isin", isin: bondIsin, name: "Titolo", type: "azione", currency: "EUR" });
    expect(stock.response.status).toBe(400);
  });

  it("la ricerca unisce strumenti noti, fonti di mercato, crypto e riconosce un ISIN", async () => {
    const body = await (await search(new NextRequest("http://localhost/api/instruments/search?q=IE00BK5BQT80"))).json();
    expect(body.market.map((h: { symbol: string }) => h.symbol)).toEqual(["VWCE.DE", "VWCE.MI"]);
    expect(body.isin).toBe("IE00BK5BQT80");
    const crypto = await (await search(new NextRequest("http://localhost/api/instruments/search?q=bitcoin"))).json();
    expect(crypto.crypto[0].id).toBe("bitcoin");
  });

  it("rinomina solo gli strumenti manuali propri", async () => {
    const shared = await createAndTrack({ source: "yahoo", yahooSymbol: uniqueTicker(), name: "Azione", type: "azione" });
    const denied = await renameInstrument(
      new NextRequest(`http://localhost/api/instruments/${shared.json.id}`, { method: "PATCH", body: JSON.stringify({ name: "Mela" }) }),
      { params: Promise.resolve({ id: shared.json.id }) }
    );
    expect(denied.status).toBe(403);

    const manual = await createAndTrack({ source: "manuale", name: "Vecchio", type: "fondo", currency: "EUR" });
    const renamed = await renameInstrument(
      new NextRequest(`http://localhost/api/instruments/${manual.json.id}`, { method: "PATCH", body: JSON.stringify({ name: "Nuovo" }) }),
      { params: Promise.resolve({ id: manual.json.id }) }
    );
    expect((await renamed.json()).name).toBe("Nuovo");
  });

  it("salva, sostituisce e cancella un prezzo manuale", async () => {
    const { json } = await createAndTrack({ source: "manuale", name: "Fondo", type: "fondo", currency: "EUR" });
    const url = `http://localhost/api/instruments/${json.id}/manual-prices`;
    const ctx = { params: Promise.resolve({ id: json.id }) };
    await addManualPrice(new NextRequest(url, { method: "POST", body: JSON.stringify({ date: "2026-09-25", close: 10 }) }), ctx);
    await addManualPrice(new NextRequest(url, { method: "POST", body: JSON.stringify({ date: "2026-09-25", close: 12.5 }) }), ctx);
    const rows = await db.select().from(userInstrumentPrices).where(eq(userInstrumentPrices.instrumentId, json.id));
    expect(rows.map((r) => r.close)).toEqual(["12.50000000"]);
    const future = await addManualPrice(new NextRequest(url, { method: "POST", body: JSON.stringify({ date: "2999-01-01", close: 1 }) }), ctx);
    expect(future.status).toBe(400);
    expect((await deleteManualPrice(new NextRequest(`${url}?date=2026-09-25`, { method: "DELETE" }), ctx)).status).toBe(204);
  });
});
