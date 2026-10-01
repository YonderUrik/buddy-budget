import { NextRequest } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { debtEvents } from "@/lib/db/schema/debts";
import { accounts } from "@/lib/db/schema/accounts";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

import { auth } from "@/lib/auth";
import { GET, POST } from "./route";
import { DELETE as deleteDebt, PATCH as patchDebt } from "./[id]/route";
import { POST as postEvent } from "./[id]/events/route";
import { DELETE as deleteEvent } from "./[id]/events/[eventId]/route";
import { POST as postBulk } from "./[id]/payments/bulk/route";

const mockedGetSession = vi.mocked(auth.api.getSession);

function request(url: string, method: string, body?: unknown) {
  return new NextRequest(`http://localhost${url}`, { method, body: body === undefined ? undefined : JSON.stringify(body) });
}
const idParams = (id: string) => ({ params: Promise.resolve({ id }) });
const eventParams = (id: string, eventId: string) => ({ params: Promise.resolve({ id, eventId }) });

const loan = {
  name: "Prestito personale",
  startMode: "origine",
  principal: 12000,
  annualRate: 6,
  installments: 12,
  firstInstallmentDate: "2026-03-05",
};

describe("route debiti", () => {
  const userIds: string[] = [];
  let userId: string;

  async function createUser() {
    const id = `test-debts-${crypto.randomUUID()}`;
    await db.insert(authUser).values({ id, name: "Test", email: `${id}@example.com`, emailVerified: false, currency: "EUR" });
    userIds.push(id);
    return id;
  }

  async function createDebt(body: object = loan) {
    const res = await POST(request("/api/debts", "POST", body));
    expect(res.status).toBe(201);
    return ((await res.json()) as { id: string }).id;
  }

  beforeEach(async () => {
    userId = await createUser();
    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);
  });

  afterEach(async () => {
    await db.delete(authUser).where(inArray(authUser.id, userIds));
    userIds.length = 0;
  });

  it("401 senza sessione su tutte le route", async () => {
    mockedGetSession.mockResolvedValue(null as never);
    const id = crypto.randomUUID();
    expect((await GET(request("/api/debts", "GET"))).status).toBe(401);
    expect((await POST(request("/api/debts", "POST", loan))).status).toBe(401);
    expect((await patchDebt(request("/x", "PATCH", { name: "a" }), idParams(id))).status).toBe(401);
    expect((await deleteDebt(request("/x", "DELETE"), idParams(id))).status).toBe(401);
    expect((await postEvent(request("/x", "POST", {}), idParams(id))).status).toBe(401);
    expect((await deleteEvent(request("/x", "DELETE"), eventParams(id, id))).status).toBe(401);
  });

  it("crea i tre tipi di avvio e li restituisce nella vista con piano e totali", async () => {
    await createDebt();
    await createDebt({ ...loan, name: "Nuovo", startMode: "nuovo", firstInstallmentDate: "2027-01-05" });
    await createDebt({ ...loan, name: "Oggi", startMode: "fotografia", anchorDate: "2026-09-30", principal: 4000, installments: 6, firstInstallmentDate: "2026-10-15", installment: 680 });
    const res = await GET(request("/api/debts", "GET"));
    const view = (await res.json()) as { debts: { name: string; plan: { rows: unknown[] } }[]; overview: { openCount: number; totalResidual: number } };
    expect(view.debts.map((d) => d.name).sort()).toEqual(["Nuovo", "Oggi", "Prestito personale"]);
    expect(view.overview.openCount).toBeGreaterThanOrEqual(2);
    expect(view.debts.find((d) => d.name === "Oggi")?.plan.rows).toHaveLength(6);
  });

  it("rifiuta dati non validi", async () => {
    expect((await POST(request("/api/debts", "POST", { ...loan, annualRate: 400 }))).status).toBe(400);
    expect((await POST(request("/api/debts", "POST", { ...loan, startMode: "fotografia" }))).status).toBe(400);
  });

  it("non mostra né tocca i debiti di un altro utente (IDOR)", async () => {
    const id = await createDebt();
    const otherId = await createUser();
    mockedGetSession.mockResolvedValue({ user: { id: otherId } } as never);

    const view = (await (await GET(request("/api/debts", "GET"))).json()) as { debts: unknown[] };
    expect(view.debts).toHaveLength(0);
    expect((await patchDebt(request("/x", "PATCH", { name: "rubato" }), idParams(id))).status).toBe(404);
    expect((await deleteDebt(request("/x", "DELETE"), idParams(id))).status).toBe(404);
    const ev = { type: "payment", installmentNumber: 1, date: "2026-03-05", amount: 1035 };
    expect((await postEvent(request("/x", "POST", ev), idParams(id))).status).toBe(404);
  });

  it("un pagamento segna la rata, non si può pagare due volte né su una rata inesistente", async () => {
    const id = await createDebt();
    const pay = (n: number) => postEvent(request("/x", "POST", { type: "payment", installmentNumber: n, date: "2026-03-05", amount: 1035.5 }), idParams(id));
    expect((await pay(1)).status).toBe(201);
    expect((await pay(1)).status).toBe(400);
    expect((await pay(99)).status).toBe(400);
    const view = (await (await GET(request("/api/debts", "GET"))).json()) as { debts: { plan: { rows: { number: number; status: string }[] } }[] };
    expect(view.debts[0].plan.rows[0].status).toBe("pagata");
  });

  it("cambio tasso e correzione del residuo cambiano il piano; oltre l'ultima rata sono rifiutati", async () => {
    const id = await createDebt({ ...loan, startMode: "nuovo", firstInstallmentDate: "2027-01-05" });
    const before = (await (await GET(request("/api/debts", "GET"))).json()) as { debts: { plan: { totals: { interestRemaining: number } } }[] };
    expect((await postEvent(request("/x", "POST", { type: "rate_change", date: "2027-03-01", rate: 9 }), idParams(id))).status).toBe(201);
    const after = (await (await GET(request("/api/debts", "GET"))).json()) as { debts: { plan: { totals: { interestRemaining: number } } }[] };
    expect(after.debts[0].plan.totals.interestRemaining).toBeGreaterThan(before.debts[0].plan.totals.interestRemaining);
    expect((await postEvent(request("/x", "POST", { type: "balance_correction", date: "2031-01-01", amount: 100 }), idParams(id))).status).toBe(400);
  });

  it("un'estinzione anticipata accorcia il piano, salva penale ed effetto, e dopo la chiusura non se ne accettano altre", async () => {
    const id = await createDebt({ ...loan, startMode: "nuovo", installments: 24, firstInstallmentDate: "2027-01-05" });
    const early = (amount: number, date = "2027-06-10") =>
      postEvent(request("/x", "POST", { type: "early_repayment", date, amount, penalty: 25, effect: "reduce_duration" }), idParams(id));
    expect((await early(3000)).status).toBe(201);
    type View = { debts: { plan: { rows: unknown[]; earlyRepayments: unknown[]; totals: { closedOn: string | null } }; events: { penalty: number; effect: string }[] }[] };
    const view = (await (await GET(request("/api/debts", "GET"))).json()) as View;
    expect(view.debts[0].plan.rows.length).toBeLessThan(24);
    expect(view.debts[0].events[0]).toMatchObject({ penalty: 25, effect: "reduce_duration" });
    expect((await early(99999, "2027-08-10")).status).toBe(201);
    const closed = (await (await GET(request("/api/debts", "GET"))).json()) as View;
    expect(closed.debts[0].plan.totals.closedOn).toBe("2027-08-10");
    expect((await early(10, "2027-09-10")).status).toBe(400);
    expect((await postEvent(request("/x", "POST", { type: "early_repayment", date: "2027-06-10", amount: 10, effect: "boh" }), idParams(id))).status).toBe(400);
  });

  it("collega una transazione solo se è dell'utente", async () => {
    const id = await createDebt();
    const otherId = await createUser();
    const [account] = await db.insert(accounts).values({ userId: otherId, name: "Conto", type: "corrente", balance: "0" } as never).returning();
    const [category] = await db.insert(categories).values({ userId: otherId, name: "Altro", type: "dovuta" } as never).returning();
    const [tx] = await db
      .insert(transactions)
      .values({ userId: otherId, accountId: account.id, categoryId: category.id, description: "x", amount: "-100", date: "2026-03-05" } as never)
      .returning();
    const res = await postEvent(
      request("/x", "POST", { type: "payment", installmentNumber: 1, date: "2026-03-05", amount: 1000, transactionId: tx.id }),
      idParams(id)
    );
    expect(res.status).toBe(404);
  });

  it("elimina un evento e poi il debito con la cascata", async () => {
    const id = await createDebt();
    const created = await postEvent(request("/x", "POST", { type: "payment", installmentNumber: 1, date: "2026-03-05", amount: 1000 }), idParams(id));
    const eventId = ((await created.json()) as { id: string }).id;
    expect((await deleteEvent(request("/x", "DELETE"), eventParams(id, eventId))).status).toBe(204);
    expect((await deleteEvent(request("/x", "DELETE"), eventParams(id, eventId))).status).toBe(404);
    await postEvent(request("/x", "POST", { type: "payment", installmentNumber: 2, date: "2026-04-05", amount: 1000 }), idParams(id));
    expect((await deleteDebt(request("/x", "DELETE"), idParams(id))).status).toBe(204);
    expect(await db.select().from(debtEvents).where(eq(debtEvents.debtId, id))).toHaveLength(0);
  });

  it("modifica nome e spese", async () => {
    const id = await createDebt();
    const res = await patchDebt(request("/x", "PATCH", { name: "Rinominato", costs: [{ label: "Assicurazione", amount: 4, kind: "per_rata" }] }), idParams(id));
    expect(res.status).toBe(200);
    const view = (await (await GET(request("/api/debts", "GET"))).json()) as { debts: { name: string; costs: unknown[] }[] };
    expect(view.debts[0]).toMatchObject({ name: "Rinominato" });
    expect(view.debts[0].costs).toHaveLength(1);
  });

  it("segna in blocco le rate scadute fino a una rata, senza toccare quelle future né quelle già pagate", async () => {
    const id = await createDebt({ ...loan, firstInstallmentDate: "2026-01-05" });
    await postEvent(request("/x", "POST", { type: "payment", installmentNumber: 1, date: "2026-01-05", amount: 1035.5 }), idParams(id));
    const res = await postBulk(request("/x", "POST", { upToInstallment: 4 }), idParams(id));
    expect(res.status).toBe(201);
    expect(((await res.json()) as { count: number }).count).toBe(3);
    const view = (await (await GET(request("/api/debts", "GET"))).json()) as { debts: { plan: { rows: { number: number; status: string; payment: { amount: number } | null }[] } }[] };
    const rows = view.debts[0].plan.rows;
    expect(rows.slice(0, 4).every((r) => r.status === "pagata")).toBe(true);
    expect(rows[0].payment?.amount).toBe(1035.5);
    // Una seconda chiamata non ha più nulla da segnare; un'altra utente non può usarla.
    expect((await postBulk(request("/x", "POST", { upToInstallment: 4 }), idParams(id))).status).toBe(400);
    const otherId = await createUser();
    mockedGetSession.mockResolvedValue({ user: { id: otherId } } as never);
    expect((await postBulk(request("/x", "POST", { upToInstallment: 4 }), idParams(id))).status).toBe(404);
  });
});
