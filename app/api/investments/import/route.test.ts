import { NextRequest, after } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { instruments, investmentTransactions } from "@/lib/db/schema/investments";
import { redis } from "@/lib/redis/client";

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: vi.fn() };
});
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

import { auth } from "@/lib/auth";
import { POST as runImport } from "./route";
import { POST as resolveImport } from "./resolve/route";

const mockedGetSession = vi.mocked(auth.api.getSession);

function post(url: string, body: unknown) {
  return new NextRequest(url, { method: "POST", body: JSON.stringify(body) });
}

const buy = (line: number, date: string, quantity: number, price: number, key = "k1") => ({
  key,
  line,
  type: "acquisto",
  date,
  quantity,
  price,
  grossAmount: null,
  fees: 0,
  taxes: 0,
  note: null,
});

describe("API import investimenti", () => {
  let userId: string;
  let instrumentId: string;

  beforeAll(() => {
    process.env.MARKET_DATA_FAKE = "1";
  });

  beforeEach(async () => {
    userId = `test-import-${crypto.randomUUID()}`;
    await db.insert(authUser).values({ id: userId, name: "Test", email: `${userId}@example.com`, emailVerified: false, currency: "EUR" });
    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);
    vi.mocked(after).mockImplementation(() => {});
    const [instrument] = await db
      .insert(instruments)
      .values({ name: "ETF import test", type: "etf", currency: "EUR", priceMode: "manuale", createdByUserId: userId })
      .returning();
    instrumentId = instrument.id;
  });

  afterEach(async () => {
    // Solo gli strumenti manuali di questo utente: quelli comuni possono essere usati da altri.
    const own = await db.select({ id: instruments.id }).from(instruments).where(eq(instruments.createdByUserId, userId));
    await db.delete(authUser).where(eq(authUser.id, userId));
    if (own.length > 0) await db.delete(instruments).where(inArray(instruments.id, own.map((i) => i.id)));
  });

  afterAll(async () => {
    delete process.env.MARKET_DATA_FAKE;
    redis.disconnect();
    await client.end();
  });

  it("abbina i simboli Yahoo, le crypto su CoinGecko e segnala quelli non trovati", async () => {
    const identity = (key: string, symbol: string) => ({ key, symbol, isin: null, name: null, currency: null, symbolIsYahoo: true });
    const response = await resolveImport(
      post("http://localhost/api/investments/import/resolve", {
        identities: [identity("a", "SWDA.MI"), identity("b", "ETH-EUR"), identity("c", "NONESISTE.XX")],
      })
    );
    expect(response.status).toBe(200);
    const { results } = await response.json();
    const [swda, eth, missing] = results.map((r: { match: unknown }) => r.match);
    expect(["known", "proposal"]).toContain(swda.kind);
    if (swda.kind === "proposal") expect(swda.input).toMatchObject({ source: "yahoo", yahooSymbol: "SWDA.MI", type: "etf" });
    if (eth.kind === "proposal") expect(eth.input).toEqual({ source: "coingecko", coingeckoId: "ethereum", name: "Ethereum", currency: "EUR" });
    expect(["known", "proposal"]).toContain(eth.kind);
    expect(missing).toEqual({ kind: "none", reason: "not_found" });
  });

  it("l'anteprima non scrive nulla e l'import salva tutto, saltando i doppioni al secondo giro", async () => {
    const body = {
      dryRun: true,
      instruments: [{ key: "k1", instrumentId }],
      operations: [buy(2, "2026-01-05", 2, 100), buy(3, "2026-02-05", 0.5, 0)],
    };
    const preview = await (await runImport(post("http://localhost/api/investments/import", body))).json();
    expect(preview.counts).toEqual({ new: 2, duplicate: 0, error: 0 });
    expect(await db.select().from(investmentTransactions).where(eq(investmentTransactions.userId, userId))).toHaveLength(0);

    const first = await runImport(post("http://localhost/api/investments/import", { ...body, dryRun: false }));
    expect(first.status).toBe(201);
    expect((await first.json()).inserted).toBe(2);
    const again = await (await runImport(post("http://localhost/api/investments/import", { ...body, dryRun: false }))).json();
    expect(again).toMatchObject({ inserted: 0, counts: { new: 0, duplicate: 2, error: 0 } });
    expect(await db.select().from(investmentTransactions).where(eq(investmentTransactions.userId, userId))).toHaveLength(2);
  });

  it("con una riga in errore non salva niente", async () => {
    const response = await runImport(
      post("http://localhost/api/investments/import", {
        dryRun: false,
        instruments: [{ key: "k1", instrumentId }],
        operations: [buy(2, "2026-01-05", 1, 100), { ...buy(3, "2026-01-06", 5, 100), type: "vendita" }],
      })
    );
    expect(response.status).toBe(400);
    const result = await response.json();
    expect(result.rows[1]).toEqual({ line: 3, status: "error", message: "Vende più quote di quelle possedute a quella data" });
    expect(await db.select().from(investmentTransactions).where(eq(investmentTransactions.userId, userId))).toHaveLength(0);
  });

  it("crea gli strumenti proposti all'import e rifiuta quelli di un altro utente", async () => {
    const created = await runImport(
      post("http://localhost/api/investments/import", {
        dryRun: false,
        instruments: [{ key: "m", create: { source: "manuale", name: "Fondo import test", type: "fondo", currency: "EUR" } }],
        operations: [buy(2, "2026-01-05", 3, 10, "m")],
      })
    );
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ inserted: 1, instrumentsCreated: 1 });

    const otherId = `test-import-${crypto.randomUUID()}`;
    await db.insert(authUser).values({ id: otherId, name: "Altro", email: `${otherId}@example.com`, emailVerified: false, currency: "EUR" });
    mockedGetSession.mockResolvedValue({ user: { id: otherId } } as never);
    const denied = await runImport(
      post("http://localhost/api/investments/import", { dryRun: true, instruments: [{ key: "k1", instrumentId }], operations: [buy(2, "2026-01-05", 1, 1)] })
    );
    expect(denied.status).toBe(422);
    await db.delete(authUser).where(eq(authUser.id, otherId));
  });
});
