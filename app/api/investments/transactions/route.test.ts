import { NextRequest, after } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { fxRates, instruments, investmentTransactions } from "@/lib/db/schema/investments";
import { redis } from "@/lib/redis/client";

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: vi.fn() };
});
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

import { auth } from "@/lib/auth";
import { POST as createOperation } from "./route";
import { PATCH as updateOperation, DELETE as deleteOperation } from "./[id]/route";
import { GET as overview } from "../overview/route";
import { PATCH as updatePortfolio } from "../portfolio/route";

const mockedGetSession = vi.mocked(auth.api.getSession);
const afterTasks: Promise<unknown>[] = [];
// Valuta di test ISO 4217: le righe di cambio si ripuliscono senza toccare dati reali.
const TEST_CURRENCY = "XTS";

function json(method: string, url: string, body: unknown) {
  return new NextRequest(url, { method, body: JSON.stringify(body) });
}

describe("API operazioni e panoramica", () => {
  const userIds: string[] = [];
  let userId: string;
  let eurInstrumentId: string;
  let foreignInstrumentId: string;
  const extraInstrumentIds: string[] = [];

  async function createUser() {
    const [user] = await db
      .insert(authUser)
      .values({
        id: `test-investments-${crypto.randomUUID()}`,
        name: "Test",
        email: `test-investments-${crypto.randomUUID()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    userIds.push(user.id);
    return user.id;
  }

  async function operation(body: Record<string, unknown>) {
    return createOperation(json("POST", "http://localhost/api/investments/transactions", body));
  }

  beforeAll(() => {
    process.env.MARKET_DATA_FAKE = "1";
  });

  beforeEach(async () => {
    userId = await createUser();
    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);
    afterTasks.length = 0;
    vi.mocked(after).mockImplementation((task) => {
      afterTasks.push(Promise.resolve(typeof task === "function" ? task() : task));
    });
    // Strumenti manuali (nessun recupero storico) creati per l'utente di test.
    const [eur] = await db
      .insert(instruments)
      .values({ name: "ETF test", type: "etf", currency: "EUR", priceMode: "manuale", createdByUserId: userId })
      .returning();
    const [foreign] = await db
      .insert(instruments)
      .values({ name: "Azione test", type: "azione", currency: TEST_CURRENCY, priceMode: "manuale", createdByUserId: userId })
      .returning();
    eurInstrumentId = eur.id;
    foreignInstrumentId = foreign.id;
  });

  afterEach(async () => {
    await Promise.all(afterTasks);
    await db.delete(authUser).where(inArray(authUser.id, userIds));
    await db.delete(instruments).where(inArray(instruments.id, [eurInstrumentId, foreignInstrumentId, ...extraInstrumentIds]));
    extraInstrumentIds.length = 0;
    await db.delete(fxRates).where(eq(fxRates.currency, TEST_CURRENCY));
    userIds.length = 0;
  });

  afterAll(async () => {
    delete process.env.MARKET_DATA_FAKE;
    redis.disconnect();
    await client.end();
  });

  it("registra un acquisto nel portafoglio di default con cambio 1 nella stessa valuta", async () => {
    const response = await operation({ instrumentId: eurInstrumentId, type: "acquisto", date: "2026-09-01", quantity: 10, price: 100, fees: 2.5 });
    expect(response.status).toBe(201);
    const created = await response.json();
    expect([created.quantity, created.price, created.fxRate, created.fees]).toEqual(["10.0000000000", "100.00000000", "1.00000000", "2.50"]);
  });

  it("rifiuta una vendita oltre le quote possedute e una data futura", async () => {
    await operation({ instrumentId: eurInstrumentId, type: "acquisto", date: "2026-09-01", quantity: 10, price: 100 });
    const oversold = await operation({ instrumentId: eurInstrumentId, type: "vendita", date: "2026-09-02", quantity: 11, price: 100 });
    expect(oversold.status).toBe(400);
    expect((await oversold.json()).error).toContain("02/09/2026");
    const future = await operation({ instrumentId: eurInstrumentId, type: "acquisto", date: "2999-01-01", quantity: 1, price: 1 });
    expect(future.status).toBe(400);
  });

  it("precompila il cambio dalla BCE (qui fonte finta) se lo strumento è in un'altra valuta", async () => {
    await db.insert(fxRates).values({ date: "2026-09-01", currency: TEST_CURRENCY, perEur: "2", source: "ecb" });
    const response = await operation({ instrumentId: foreignInstrumentId, type: "acquisto", date: "2026-09-02", quantity: 1, price: 50 });
    expect(response.status).toBe(201);
    expect((await response.json()).fxRate).toBe("0.50000000");
  });

  it("chiede il cambio a mano se non è disponibile", async () => {
    const response = await operation({ instrumentId: foreignInstrumentId, type: "acquisto", date: "2026-09-02", quantity: 1, price: 50 });
    expect(response.status).toBe(422);
    const manual = await operation({ instrumentId: foreignInstrumentId, type: "acquisto", date: "2026-09-02", quantity: 1, price: 50, fxRate: 0.9 });
    expect(manual.status).toBe(201);
  });

  it("un dividendo salva l'importo lordo e azzera quantità e prezzo", async () => {
    const response = await operation({ instrumentId: eurInstrumentId, type: "dividendo", date: "2026-09-01", grossAmount: 12.34, taxes: 3.21, quantity: 5, price: 5 });
    const created = await response.json();
    expect([created.quantity, created.price, created.grossAmount, created.taxes]).toEqual(["0.0000000000", "0.00000000", "12.34", "3.21"]);
  });

  it("non permette di toccare le operazioni o gli strumenti di un altro utente", async () => {
    const created = await (await operation({ instrumentId: eurInstrumentId, type: "acquisto", date: "2026-09-01", quantity: 1, price: 1 })).json();
    const other = await createUser();
    mockedGetSession.mockResolvedValue({ user: { id: other } } as never);
    const ctx = { params: Promise.resolve({ id: created.id }) };
    expect((await deleteOperation(new NextRequest("http://localhost/x", { method: "DELETE" }), ctx)).status).toBe(404);
    expect((await operation({ instrumentId: eurInstrumentId, type: "acquisto", date: "2026-09-01", quantity: 1, price: 1 })).status).toBe(404);
  });

  it("modifica ed eliminazione ricontrollano le vendite successive", async () => {
    const buy = await (await operation({ instrumentId: eurInstrumentId, type: "acquisto", date: "2026-09-01", quantity: 10, price: 100 })).json();
    await operation({ instrumentId: eurInstrumentId, type: "vendita", date: "2026-09-10", quantity: 8, price: 110 });
    const ctx = { params: Promise.resolve({ id: buy.id }) };

    const shrink = await updateOperation(
      json("PATCH", "http://localhost/x", { type: "acquisto", date: "2026-09-01", quantity: 5, price: 100 }),
      ctx
    );
    expect(shrink.status).toBe(400);
    const edit = await updateOperation(
      json("PATCH", "http://localhost/x", { type: "acquisto", date: "2026-09-01", quantity: 12, price: 99 }),
      ctx
    );
    expect((await edit.json()).quantity).toBe("12.0000000000");

    const remove = await deleteOperation(new NextRequest("http://localhost/x", { method: "DELETE" }), ctx);
    expect(remove.status).toBe(400);
    expect(await db.select().from(investmentTransactions).where(eq(investmentTransactions.id, buy.id))).toHaveLength(1);
  });

  it("la panoramica restituisce operazioni, strumenti e valuta dell'utente", async () => {
    await operation({ instrumentId: eurInstrumentId, type: "acquisto", date: "2026-09-01", quantity: 10, price: 100 });
    const body = await (await overview(new NextRequest("http://localhost/api/investments/overview?period=1mese"))).json();
    expect(body.currency).toBe("EUR");
    expect(body.portfolios).toHaveLength(1);
    expect(body.transactions).toHaveLength(1);
    expect(body.instruments.map((i: { id: string }) => i.id)).toEqual([eurInstrumentId]);
  });

  it("uno split salva solo il rapporto e permette di vendere le quote nuove", async () => {
    await operation({ instrumentId: eurInstrumentId, type: "acquisto", date: "2026-09-01", quantity: 10, price: 100 });
    const split = await operation({ instrumentId: eurInstrumentId, type: "split", date: "2026-09-02", quantity: 2, price: 7, fees: 1 });
    expect(split.status).toBe(201);
    expect(await split.json()).toMatchObject({ quantity: "2.0000000000", price: "0.00000000", fees: "0.00" });
    const sell = await operation({ instrumentId: eurInstrumentId, type: "vendita", date: "2026-09-03", quantity: 20, price: 50 });
    expect(sell.status).toBe(201);
    expect((await operation({ instrumentId: eurInstrumentId, type: "split", date: "2026-09-04", quantity: 0 })).status).toBe(400);
  });

  it("sceglie e toglie il benchmark, che la panoramica restituisce a parte dagli strumenti posseduti", async () => {
    const [benchmark] = await db
      .insert(instruments)
      .values({ name: "Indice test", type: "etf", currency: "EUR", priceMode: "auto", createdByUserId: userId })
      .returning();
    extraInstrumentIds.push(benchmark.id);
    await operation({ instrumentId: eurInstrumentId, type: "acquisto", date: "2026-09-01", quantity: 10, price: 100 });

    const manual = await updatePortfolio(json("PATCH", "http://localhost/x", { benchmarkInstrumentId: eurInstrumentId }));
    expect(manual.status).toBe(400);
    const chosen = await updatePortfolio(json("PATCH", "http://localhost/x", { benchmarkInstrumentId: benchmark.id }));
    expect(chosen.status).toBe(200);
    expect((await chosen.json()).benchmarkInstrumentId).toBe(benchmark.id);
    expect(afterTasks.length).toBeGreaterThan(0);

    const body = await (await overview(new NextRequest("http://localhost/api/investments/overview?period=1mese"))).json();
    expect(body.benchmark.id).toBe(benchmark.id);
    expect(body.instruments.map((i: { id: string }) => i.id)).toEqual([eurInstrumentId]);

    const cleared = await updatePortfolio(json("PATCH", "http://localhost/x", { benchmarkInstrumentId: null }));
    expect((await cleared.json()).benchmarkInstrumentId).toBeNull();

    const other = await createUser();
    mockedGetSession.mockResolvedValue({ user: { id: other } } as never);
    expect((await updatePortfolio(json("PATCH", "http://localhost/x", { benchmarkInstrumentId: benchmark.id }))).status).toBe(404);
  });
});
