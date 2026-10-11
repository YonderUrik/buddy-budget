import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { accounts } from "@/lib/db/schema/accounts";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";
import { resolveCategorization } from "@/lib/categorization/resolve";
import { effectiveAmount } from "@/lib/calc/expenses";
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
import { auth } from "@/lib/auth";
import { PATCH } from "./[id]/route";
import { POST as apply } from "./categorize-apply/route";
import { POST as create } from "./route";
import { PATCH as editCategory } from "../categories/[id]/route";

const userId = `test-transfers-${crypto.randomUUID()}`;
let accountId: string, transferId: string, expenseId: string, incomeId: string;
const request = (body: unknown, method = "PATCH") => new NextRequest("http://localhost/api/transactions", { method, body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
const params = (id: string) => ({ params: Promise.resolve({ id }) });
async function movement(amount: string) {
  const [row] = await db.insert(transactions).values({ userId, accountId, categoryId: Number(amount) > 0 ? incomeId : expenseId, description: "Giroconto", date: "2026-10-11", amount, source: "manuale" }).returning();
  return row;
}
beforeAll(async () => {
  await db.insert(authUser).values({ id: userId, name: "Transfer test", email: `${userId}@example.com` });
  vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: userId } } as never);
  [accountId] = (await db.insert(accounts).values({ userId, name: "Conto test", type: "Contanti", source: "manuale", balance: "500" }).returning()).map((r) => r.id);
  const rows = await db.insert(categories).values([
    { userId, name: "Giroconti", type: "trasferimento" as const },
    { userId, name: "Spese", type: "voluta" as const },
    { userId, name: "Entrate", type: "entrata" as const },
  ]).returning();
  [transferId, expenseId, incomeId] = rows.map((r) => r.id);
});
afterAll(async () => { await db.delete(authUser).where(eq(authUser.id, userId)); await client.end(); });
describe("trasferimenti tra conti", () => {
  it.each(["-250.00", "250.00"])("esclude %s, conserva il segno e ripristina il conteggio ricategorizzando", async (amount) => {
    const row = await movement(amount);
    const result = await PATCH(request({ categoryId: transferId }), params(row.id));
    expect(result.status).toBe(200);
    const transfer = await result.json();
    expect(transfer.amount).toBe(amount);
    expect(transfer.excludedAmount).toBe(amount);
    expect(effectiveAmount(transfer)).toBe(0);
    const noSplit = await PATCH(request({ excludedAmount: 0 }), params(row.id));
    expect((await noSplit.json()).excludedAmount).toBe(amount);
    const restored = await PATCH(request({ categoryId: Number(amount) > 0 ? incomeId : expenseId }), params(row.id));
    expect((await restored.json()).excludedAmount).toBe("0.00");
  });
  it("esclude entrambi i lati dal batch e dalle regole future", async () => {
    const out = await movement("-100.00"), incoming = await movement("100.00");
    const result = await apply(request({ groups: [{ transactionIds: [out.id, incoming.id], categoryId: transferId, merchantKey: "giroconto", createRule: true }] }, "POST"));
    expect(result.status).toBe(200);
    for (const row of [out, incoming]) {
      const [saved] = await db.select().from(transactions).where(eq(transactions.id, row.id));
      expect(effectiveAmount(saved)).toBe(0);
    }
    expect(await resolveCategorization(userId, { description: "giroconto", amount: 60 })).toMatchObject({ categoryId: transferId, excludedAmount: 60 });
    expect(await resolveCategorization(userId, { description: "giroconto", amount: -60 })).toMatchObject({ categoryId: transferId, excludedAmount: -60 });
  });
  it("mantiene l'esclusione intera modificando l'importo", async () => {
    const row = await movement("-100.00");
    await PATCH(request({ categoryId: transferId }), params(row.id));
    const result = await PATCH(request({ amount: 20 }), params(row.id));
    expect(await result.json()).toMatchObject({ amount: "-20.00", excludedAmount: "-20.00" });
  });
  it.each(["entrata", "uscita"])("crea un giroconto manuale in %s", async (direction) => {
    const result = await create(request({ accountId, categoryId: transferId, description: "Giroconto manuale", amount: 75, direction, date: "2026-10-11" }, "POST"));
    expect(result.status).toBe(201);
    const row = await result.json();
    expect(row.amount).toBe(direction === "entrata" ? "75.00" : "-75.00");
    expect(effectiveAmount(row)).toBe(0);
  });
  it("aggiorna i conteggi cambiando il tipo della categoria", async () => {
    const row = await movement("-90.00");
    await editCategory(request({ type: "trasferimento" }), params(expenseId));
    let [saved] = await db.select().from(transactions).where(eq(transactions.id, row.id));
    expect(effectiveAmount(saved)).toBe(0);
    await editCategory(request({ type: "voluta" }), params(expenseId));
    [saved] = await db.select().from(transactions).where(eq(transactions.id, row.id));
    expect(effectiveAmount(saved)).toBe(-90);
  });
});
