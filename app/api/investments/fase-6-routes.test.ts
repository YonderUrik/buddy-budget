import { NextRequest } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { instrumentPrices, instruments, userPriceAlerts, userWatchlistItems } from "@/lib/db/schema/investments";
import { evaluatePriceAlerts } from "@/lib/investments/alerts-run";
import { findHeldAutoInstruments } from "@/lib/market-data/store";

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: vi.fn() };
});
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
// Niente rete: lo storico e i numeri chiave non vanno cercati in questi test.
vi.mock("@/lib/market-data/runtime", () => ({
  ensureHistory: vi.fn().mockResolvedValue(false),
  fundamentalsOnProviders: vi.fn().mockResolvedValue({ status: "unavailable" }),
}));

import { auth } from "@/lib/auth";
import { GET as getAnalysis } from "@/app/api/instruments/[id]/analysis/route";
import { DELETE as unwatch, PUT as watch } from "@/app/api/instruments/[id]/watch/route";
import { POST as createAlert } from "@/app/api/instruments/[id]/alerts/route";
import { DELETE as deleteAlert } from "@/app/api/instruments/[id]/alerts/[alertId]/route";
import { GET as getTitles } from "./titles/route";

const mockedGetSession = vi.mocked(auth.api.getSession);

function request(url: string, method: string, body?: unknown) {
  return new NextRequest(`http://localhost${url}`, { method, body: body === undefined ? undefined : JSON.stringify(body) });
}

function dayKey(offset: number): string {
  return new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
}

describe("route Fase 6 (analisi titoli, watchlist, avvisi)", () => {
  const userIds: string[] = [];
  const instrumentIds: string[] = [];
  let userId: string;

  async function createUser() {
    const id = `test-fase6-${crypto.randomUUID()}`;
    await db.insert(authUser).values({ id, name: "Test", email: `${id}@example.com`, emailVerified: false, currency: "EUR" });
    userIds.push(id);
    return id;
  }

  /** Strumento comune con 30 chiusure da 100 a 129 (l'ultima è di oggi). */
  async function createInstrument(priceMode: "auto" | "manuale" = "auto", ownerId: string | null = null) {
    const [row] = await db
      .insert(instruments)
      .values({ name: `Titolo ${crypto.randomUUID().slice(0, 6)}`, type: "azione", currency: "EUR", priceMode, createdByUserId: ownerId })
      .returning();
    instrumentIds.push(row.id);
    if (priceMode === "auto") {
      await db.insert(instrumentPrices).values(
        Array.from({ length: 30 }, (_, i) => ({ instrumentId: row.id, date: dayKey(i - 29), close: String(100 + i), source: "yahoo" as const }))
      );
    }
    return row.id;
  }

  const params = (id: string, alertId?: string) => ({ params: Promise.resolve({ id, alertId: alertId ?? "" }) });

  beforeEach(async () => {
    userId = await createUser();
    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);
  });

  afterEach(async () => {
    await db.delete(instruments).where(inArray(instruments.id, instrumentIds));
    await db.delete(authUser).where(inArray(authUser.id, userIds));
    userIds.length = 0;
    instrumentIds.length = 0;
  });

  afterAll(async () => {
    await client.end();
  });

  it("401 senza sessione", async () => {
    mockedGetSession.mockResolvedValue(null as never);
    const id = crypto.randomUUID();
    expect((await getAnalysis(request("/x", "GET"), params(id))).status).toBe(401);
    expect((await watch(request("/x", "PUT"), params(id))).status).toBe(401);
    expect((await unwatch(request("/x", "DELETE"), params(id))).status).toBe(401);
    expect((await createAlert(request("/x", "POST", {}), params(id))).status).toBe(401);
    expect((await deleteAlert(request("/x", "DELETE"), params(id, crypto.randomUUID()))).status).toBe(401);
    expect((await getTitles(request("/x", "GET"))).status).toBe(401);
  });

  it("non mostra lo strumento manuale di un altro utente (404)", async () => {
    const other = await createUser();
    const id = await createInstrument("manuale", other);
    expect((await getAnalysis(request(`/api/instruments/${id}/analysis`, "GET"), params(id))).status).toBe(404);
    expect((await watch(request("/x", "PUT"), params(id))).status).toBe(404);
    expect((await createAlert(request("/x", "POST", { direction: "sopra", targetPrice: 200 }), params(id))).status).toBe(404);
  });

  it("l'analisi dà serie, statistiche e stato di watchlist; periodo non valido = 400", async () => {
    const id = await createInstrument();
    const response = await getAnalysis(request(`/api/instruments/${id}/analysis?period=1M`, "GET"), params(id));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.stats.lastClose).toBe(129);
    expect(body.series.length).toBeGreaterThan(20);
    expect(body).toMatchObject({ watching: false, position: null, alerts: [], fundamentalsStatus: "unavailable" });
    expect((await getAnalysis(request(`/api/instruments/${id}/analysis?period=9Z`, "GET"), params(id))).status).toBe(400);
  });

  it("segue e smette di seguire in modo idempotente; l'elenco titoli lo mostra", async () => {
    const id = await createInstrument();
    expect((await watch(request("/x", "PUT"), params(id))).status).toBe(200);
    expect((await watch(request("/x", "PUT"), params(id))).status).toBe(200);
    expect(await db.select().from(userWatchlistItems).where(eq(userWatchlistItems.userId, userId))).toHaveLength(1);

    const list = await (await getTitles(request("/api/investments/titles", "GET"))).json();
    expect(list.items).toHaveLength(1);
    expect(list.items[0]).toMatchObject({ watching: true, held: false, lastClose: 129 });

    expect((await unwatch(request("/x", "DELETE"), params(id))).status).toBe(200);
    expect((await (await getTitles(request("/x", "GET"))).json()).items).toHaveLength(0);
  });

  it("crea avvisi validi e rifiuta livelli già superati, strumenti manuali e oltre il massimo", async () => {
    const id = await createInstrument();
    const ok = await createAlert(request("/x", "POST", { direction: "sopra", targetPrice: 200 }), params(id));
    expect(ok.status).toBe(201);
    expect((await createAlert(request("/x", "POST", { direction: "sopra", targetPrice: 120 }), params(id))).status).toBe(400); // 129 ≥ 120
    expect((await createAlert(request("/x", "POST", { direction: "sotto", targetPrice: 150 }), params(id))).status).toBe(400); // 129 ≤ 150
    expect((await createAlert(request("/x", "POST", { direction: "boh", targetPrice: 5 }), params(id))).status).toBe(400);
    expect((await createAlert(request("/x", "POST", { direction: "sotto", targetPrice: -1 }), params(id))).status).toBe(400);

    const manual = await createInstrument("manuale", userId);
    expect((await createAlert(request("/x", "POST", { direction: "sopra", targetPrice: 5 }), params(manual))).status).toBe(400);

    for (let i = 0; i < 9; i += 1) {
      expect((await createAlert(request("/x", "POST", { direction: "sopra", targetPrice: 300 + i }), params(id))).status).toBe(201);
    }
    expect((await createAlert(request("/x", "POST", { direction: "sopra", targetPrice: 400 }), params(id))).status).toBe(400);
  });

  it("elimina solo i propri avvisi", async () => {
    const id = await createInstrument();
    const alert = await (await createAlert(request("/x", "POST", { direction: "sopra", targetPrice: 200 }), params(id))).json();
    const other = await createUser();
    mockedGetSession.mockResolvedValue({ user: { id: other } } as never);
    expect((await deleteAlert(request("/x", "DELETE"), params(id, alert.id))).status).toBe(404);
    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);
    expect((await deleteAlert(request("/x", "DELETE"), params(id, alert.id))).status).toBe(200);
    expect((await deleteAlert(request("/x", "DELETE"), params(id, "non-un-uuid"))).status).toBe(404);
  });

  it("il controllo serale fa scattare un avviso una volta sola e manda l'email", async () => {
    const id = await createInstrument();
    await createAlert(request("/x", "POST", { direction: "sopra", targetPrice: 200 }), params(id));
    await createAlert(request("/x", "POST", { direction: "sotto", targetPrice: 50 }), params(id));
    // Arriva una chiusura nuova oltre il livello dell'avviso "sopra".
    await db.insert(instrumentPrices).values({ instrumentId: id, date: dayKey(1), close: "205", source: "yahoo" });

    const send = vi.fn().mockResolvedValue(true);
    const first = await evaluatePriceAlerts({ send });
    expect(first.triggered).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toBe(`${userId}@example.com`);
    expect(send.mock.calls[0][1].subject).toContain("sale sopra");

    const second = await evaluatePriceAlerts({ send });
    expect(second.triggered).toBe(0);
    expect(send).toHaveBeenCalledTimes(1);
    const rows = await db.select().from(userPriceAlerts).where(eq(userPriceAlerts.userId, userId));
    expect(rows.filter((r) => r.status === "scattato")).toHaveLength(1);
  });

  it("un'email fallita non annulla lo scatto e viene contata", async () => {
    const id = await createInstrument();
    await createAlert(request("/x", "POST", { direction: "sopra", targetPrice: 200 }), params(id));
    await db.insert(instrumentPrices).values({ instrumentId: id, date: dayKey(1), close: "210", source: "yahoo" });
    const summary = await evaluatePriceAlerts({ send: vi.fn().mockRejectedValue(new Error("boom")) });
    expect(summary).toMatchObject({ triggered: 1, emailFailed: 1 });
    const [row] = await db.select().from(userPriceAlerts).where(eq(userPriceAlerts.userId, userId));
    expect(row.status).toBe("scattato");
  });

  it("gli strumenti seguiti o con avviso attivo entrano nell'aggiornamento serale", async () => {
    const watched = await createInstrument();
    const alerted = await createInstrument();
    const untouched = await createInstrument();
    await watch(request("/x", "PUT"), params(watched));
    await createAlert(request("/x", "POST", { direction: "sopra", targetPrice: 500 }), params(alerted));
    const ids = (await findHeldAutoInstruments()).map((i) => i.id);
    expect(ids).toContain(watched);
    expect(ids).toContain(alerted);
    expect(ids).not.toContain(untouched);
  });
});
