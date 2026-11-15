import { NextRequest } from "next/server";
import { inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { instrumentPrices, instruments } from "@/lib/db/schema/investments";
import { createBackfillStore, createMemoryBackfillKv } from "@/lib/market-data/backfill-state";
import { setBackfillStore } from "@/lib/market-data/runtime";

/**
 * Caso segnalato: l'endpoint che precompila il prezzo di un'operazione rispondeva `price: null, loading: false`
 * per sempre quando mancava un prezzo nella finestra richiesta ma ne esisteva uno molto più vecchio.
 * `ensureHistorySafely` delegava a `ensureHistory`, che si fermava su `min(date) <= fromKey`, quindi non
 * programmava alcun recupero e al giro successivo (cooldown scaduto) la scena si ripeteva identica.
 */
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: vi.fn() };
});
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

import { auth } from "@/lib/auth";
import { GET as getPriceOnDate } from "@/app/api/instruments/[id]/price/route";

const mockedGetSession = vi.mocked(auth.api.getSession);

function request(url: string) {
  return new NextRequest(`http://localhost${url}`);
}

function dayKey(offset: number): string {
  return new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
}

describe("prezzo di un'operazione: recupero avviato quando il periodo è scoperto", () => {
  const userIds: string[] = [];
  const instrumentIds: string[] = [];
  let userId: string;
  let store = createBackfillStore(createMemoryBackfillKv());

  async function createUser() {
    const id = `test-price-${crypto.randomUUID()}`;
    await db.insert(authUser).values({ id, name: "Test", email: `${id}@example.com`, emailVerified: false, currency: "EUR" });
    userIds.push(id);
    return id;
  }

  async function createInstrument(dates: string[]) {
    const [row] = await db
      .insert(instruments)
      .values({
        name: `Titolo ${crypto.randomUUID().slice(0, 6)}`,
        type: "azione",
        currency: "EUR",
        priceMode: "auto",
        createdByUserId: userId,
      })
      .returning();
    instrumentIds.push(row.id);
    await db
      .insert(instrumentPrices)
      .values(dates.map((date, i) => ({ instrumentId: row.id, date, close: String(100 + i), source: "yahoo" as const })));
    return row.id;
  }

  beforeEach(async () => {
    userId = await createUser();
    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);
    store = createBackfillStore(createMemoryBackfillKv());
    setBackfillStore(store);
  });

  afterEach(async () => {
    setBackfillStore(null);
    await db.delete(instruments).where(inArray(instruments.id, instrumentIds));
    await db.delete(authUser).where(inArray(authUser.id, userIds));
    userIds.length = 0;
    instrumentIds.length = 0;
  });

  afterAll(async () => {
    await client.end();
  });

  it("avvia il recupero invece di rispondere subito 'niente prezzo e niente in corso'", async () => {
    // Vecchia chiusura isolata, e nessun prezzo nella finestra della data richiesta.
    const id = await createInstrument([dayKey(-300)]);
    const date = dayKey(-1);

    const response = await getPriceOnDate(request(`/api/instruments/${id}/price?date=${date}`), {
      params: Promise.resolve({ id }),
    });
    const body = await response.json();
    expect(body.price).toBeNull();
    // Prima della correzione restava false: nessun recupero partiva e il polling si spegneva per sempre.
    expect(body.loading).toBe(true);

    const [state] = await store.views([id]);
    expect(state.status).toBe("running");
    // Il recupero copre l'operazione e il margine prima di essa, non i 300 giorni di buco.
    expect(state.fromKey).toBe(dayKey(-8));
  });

  it("non avvia nulla quando il prezzo del giorno è già disponibile", async () => {
    const id = await createInstrument([dayKey(-3), dayKey(-2)]);
    const response = await getPriceOnDate(request(`/api/instruments/${id}/price?date=${dayKey(-1)}`), {
      params: Promise.resolve({ id }),
    });
    const body = await response.json();

    expect(body.price).not.toBeNull();
    expect(body.loading).toBe(false);
    expect(await store.views([id])).toHaveLength(0); // nessun recupero avviato
  });
});
