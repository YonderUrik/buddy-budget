import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { client, db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { authUser } from "@/lib/db/schema/auth";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";
import { addMonthsIso } from "@/lib/calc/subscriptions";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

import { auth } from "@/lib/auth";
import { DELETE, PATCH } from "./[id]/route";
import { GET, POST } from "./route";

const mockedGetSession = vi.mocked(auth.api.getSession);
const json = (body: unknown) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("API abbonamenti", () => {
  let userId: string;
  let categoryId: string;
  const today = new Date().toISOString().slice(0, 10);

  beforeEach(async () => {
    const [user] = await db
      .insert(authUser)
      .values({ id: `test-subs-${crypto.randomUUID()}`, name: "Test", email: `test-subs-${crypto.randomUUID()}@example.com`, emailVerified: false, currency: "EUR" })
      .returning();
    userId = user.id;
    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);
    const [spesa, risparmio] = await db
      .insert(categories)
      .values([
        { userId, name: "Streaming", type: "voluta" },
        { userId, name: "ETF", type: "futuro" },
      ])
      .returning();
    categoryId = spesa.id;
    const [account] = await db.insert(accounts).values({ userId, name: "Conto", type: "Conto corrente", balance: "0" }).returning();
    // Sei mesi di "Streamix" (13,99 €, il 5) e di un versamento mensile in un ETF (categoria «Te futuro», mai un abbonamento).
    const rows = [0, 1, 2, 3, 4, 5].flatMap((back) => [
      { userId, accountId: account.id, categoryId: spesa.id, description: "Streamix", amount: "-13.99", date: addMonthsIso(`${today.slice(0, 7)}-01`, -back, 5) },
      { userId, accountId: account.id, categoryId: risparmio.id, description: "Versamento ETF", amount: "-200.00", date: addMonthsIso(`${today.slice(0, 7)}-01`, -back, 6) },
    ]).filter((row) => row.date <= today);
    await db.insert(transactions).values(rows);
  });

  afterEach(async () => {
    await db.delete(transactions).where(eq(transactions.userId, userId));
    await db.delete(authUser).where(eq(authUser.id, userId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("risponde 401 senza sessione", async () => {
    mockedGetSession.mockResolvedValueOnce(null as never);
    expect((await GET(new NextRequest("http://localhost/api/subscriptions"))).status).toBe(401);
  });

  it("rileva l'abbonamento e ignora i versamenti in investimenti", async () => {
    const view = await (await GET(new NextRequest("http://localhost/api/subscriptions"))).json();
    expect(view.items.map((i: { key: string }) => i.key)).toEqual(["streamix"]);
    expect(view.items[0]).toMatchObject({ decision: "da-confermare", cadence: "mensile", amount: 13.99 });
    expect(view.totals).toMatchObject({ count: 0, pendingCount: 1 });
  });

  it("la conferma resta memorizzata ed entra nei totali; ripristina la toglie", async () => {
    const saved = await POST(new NextRequest("http://localhost/api/subscriptions", json({ origin: "rilevato", key: "streamix", status: "confermato", name: "Streamix", amount: 13.99, cadence: "mensile", categoryId })));
    const row = await saved.json();
    expect(saved.status).toBe(200);
    let view = await (await GET(new NextRequest("http://localhost/api/subscriptions"))).json();
    expect(view.totals).toMatchObject({ count: 1, monthly: 13.99, pendingCount: 0 });

    const ended = await PATCH(new NextRequest(`http://localhost/api/subscriptions/${row.id}`, { ...json({ status: "terminato" }), method: "PATCH" }), ctx(row.id));
    expect(ended.status).toBe(200);
    view = await (await GET(new NextRequest("http://localhost/api/subscriptions"))).json();
    expect(view.items[0].decision).toBe("terminato");
    expect(view.totals.count).toBe(0);

    expect((await DELETE(new NextRequest(`http://localhost/api/subscriptions/${row.id}`, { method: "DELETE" }), ctx(row.id))).status).toBe(204);
    view = await (await GET(new NextRequest("http://localhost/api/subscriptions"))).json();
    expect(view.items[0].decision).toBe("da-confermare");
  });

  it("aggiunge un abbonamento manuale, rifiuta il doppione e valida l'input", async () => {
    const body = { origin: "manuale", name: "Club del libro", amount: 12, cadence: "mensile", nextDate: today };
    const created = await POST(new NextRequest("http://localhost/api/subscriptions", json(body)));
    expect(created.status).toBe(201);
    expect((await POST(new NextRequest("http://localhost/api/subscriptions", json(body)))).status).toBe(409);
    expect((await POST(new NextRequest("http://localhost/api/subscriptions", json({ ...body, name: "Altro", amount: -1 })))).status).toBe(400);
    const view = await (await GET(new NextRequest("http://localhost/api/subscriptions"))).json();
    expect(view.totals).toMatchObject({ count: 1, monthly: 12 });
  });

  it("non tocca le scelte di un altro utente", async () => {
    const created = await (await POST(new NextRequest("http://localhost/api/subscriptions", json({ origin: "manuale", name: "Mio", amount: 5, cadence: "mensile", nextDate: today })))).json();
    mockedGetSession.mockResolvedValue({ user: { id: "altro-utente" } } as never);
    expect((await DELETE(new NextRequest(`http://localhost/api/subscriptions/${created.id}`, { method: "DELETE" }), ctx(created.id))).status).toBe(404);
  });
});
