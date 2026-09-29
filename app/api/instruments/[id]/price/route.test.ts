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
import { GET } from "./route";

const mockedGetSession = vi.mocked(auth.api.getSession);
const afterTasks: Promise<unknown>[] = [];

function priceOn(instrumentId: string, date: string) {
  return GET(new NextRequest(`http://localhost/api/instruments/${instrumentId}/price?date=${date}`), {
    params: Promise.resolve({ id: instrumentId }),
  });
}

describe("GET /api/instruments/[id]/price", () => {
  const userIds: string[] = [];
  const instrumentIds: string[] = [];
  let userId: string;

  async function createUser() {
    const [user] = await db
      .insert(authUser)
      .values({
        id: `test-price-on-date-${crypto.randomUUID()}`,
        name: "Test",
        email: `test-price-on-date-${crypto.randomUUID()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    userIds.push(user.id);
    return user.id;
  }

  async function createInstrument(values: Partial<typeof instruments.$inferInsert> = {}) {
    const [created] = await db
      .insert(instruments)
      .values({ name: "ETF test", type: "etf", currency: "EUR", priceMode: "manuale", createdByUserId: userId, ...values })
      .returning();
    instrumentIds.push(created.id);
    return created.id;
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
  });

  afterEach(async () => {
    await Promise.all(afterTasks);
    await db.delete(authUser).where(inArray(authUser.id, userIds));
    if (instrumentIds.length) await db.delete(instruments).where(inArray(instruments.id, instrumentIds));
    userIds.length = 0;
    instrumentIds.length = 0;
  });

  afterAll(async () => {
    delete process.env.MARKET_DATA_FAKE;
    redis.disconnect();
    await client.end();
  });

  it("restituisce la chiusura del giorno, o l'ultima prima (weekend), e il prezzo manuale vince", async () => {
    const id = await createInstrument({ priceMode: "auto", createdByUserId: null });
    await db.insert(instrumentPrices).values([
      { instrumentId: id, date: "2026-09-24", close: "101.50000000", source: "yahoo" },
      { instrumentId: id, date: "2026-09-25", close: "102.25000000", source: "yahoo" },
    ]);

    expect(await (await priceOn(id, "2026-09-25")).json()).toEqual({
      price: { date: "2026-09-25", close: 102.25, origin: "yahoo" },
      loading: false,
    });
    // Sabato: vale la chiusura del venerdì.
    expect((await (await priceOn(id, "2026-09-26")).json()).price).toEqual({ date: "2026-09-25", close: 102.25, origin: "yahoo" });

    await db.insert(userInstrumentPrices).values({ userId, instrumentId: id, date: "2026-09-25", close: "99.00000000" });
    expect((await (await priceOn(id, "2026-09-25")).json()).price).toEqual({ date: "2026-09-25", close: 99, origin: "manuale" });
    expect(afterTasks).toHaveLength(0);
  });

  it("senza prezzi alla data avvia il recupero dello storico, poi il prezzo c'è", async () => {
    const id = await createInstrument({ priceMode: "auto", createdByUserId: null });
    await db.insert(instrumentSymbols).values({ instrumentId: id, provider: "yahoo", symbol: `TEST${id.slice(0, 8)}.DE` });
    await db.insert(instrumentPrices).values({ instrumentId: id, date: "2026-09-25", close: "100.00000000", source: "yahoo" });

    const first = await (await priceOn(id, "2024-03-06")).json();
    expect(first).toEqual({ price: null, loading: true });
    expect(afterTasks).toHaveLength(1);
    await Promise.all(afterTasks);

    const second = await (await priceOn(id, "2024-03-06")).json();
    expect(second.loading).toBe(false);
    expect(second.price.date).toBe("2024-03-06");
    expect(second.price.close).toBeGreaterThan(0);
    const saved = await db.select().from(instrumentPrices).where(eq(instrumentPrices.instrumentId, id));
    expect(saved.length).toBeGreaterThan(1);
  });

  it("se le fonti non hanno il prezzo non riparte a ogni richiesta", async () => {
    // Nessun simbolo: il recupero parte ma non trova nulla.
    const id = await createInstrument({ priceMode: "auto", createdByUserId: null });
    await db.insert(instrumentPrices).values({ instrumentId: id, date: "2026-09-25", close: "100.00000000", source: "yahoo" });
    await priceOn(id, "2024-03-06");
    await Promise.all(afterTasks);
    expect(await (await priceOn(id, "2024-03-06")).json()).toEqual({ price: null, loading: false });
    expect(afterTasks).toHaveLength(1);
  });

  it("uno strumento manuale senza prezzi risponde null senza recuperi", async () => {
    const id = await createInstrument();
    expect(await (await priceOn(id, "2026-09-25")).json()).toEqual({ price: null, loading: false });
    expect(afterTasks).toHaveLength(0);
  });

  it("rifiuta una data non valida e lo strumento manuale di un altro utente", async () => {
    const id = await createInstrument();
    expect((await priceOn(id, "25/09/2026")).status).toBe(400);
    mockedGetSession.mockResolvedValue({ user: { id: await createUser() } } as never);
    expect((await priceOn(id, "2026-09-25")).status).toBe(404);
  });
});
