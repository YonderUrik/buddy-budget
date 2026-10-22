import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { categories } from "@/lib/db/schema/categories";
import { budgetMonths, budgets } from "@/lib/db/schema/budgets";
import { monthKey, shiftMonth } from "@/lib/calc/budget-plan";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { DELETE, PUT } from "./route";

const mockedGetSession = vi.mocked(auth.api.getSession);

describe("PUT and DELETE /api/budgets/[categoryId]", () => {
  let userId: string;
  let categoryId: string;
  let otherUserId: string;
  let otherUserCategoryId: string;

  beforeEach(async () => {
    const testId = `test-budget-id-${crypto.randomUUID()}`;
    const [user] = await db
      .insert(authUser)
      .values({
        id: testId,
        name: "Test User",
        email: `test-budget-id-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    userId = user.id;
    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);

    const [category] = await db
      .insert(categories)
      .values({ userId, name: "Affitto", type: "dovuta" })
      .returning();
    categoryId = category.id;

    const otherId = `test-budget-id-other-${crypto.randomUUID()}`;
    const [otherUser] = await db
      .insert(authUser)
      .values({
        id: otherId,
        name: "Other User",
        email: `test-budget-id-other-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    otherUserId = otherUser.id;

    const [otherUserCategory] = await db
      .insert(categories)
      .values({ userId: otherUserId, name: "Categoria altrui", type: "voluta" })
      .returning();
    otherUserCategoryId = otherUserCategory.id;
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, otherUserId));
    await db.delete(authUser).where(eq(authUser.id, userId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("crea il budget se non esiste", async () => {
    const response = await PUT(
      new NextRequest(`http://localhost/api/budgets/${categoryId}`, {
        method: "PUT",
        body: JSON.stringify({ monthlyAmount: 700 }),
      }),
      { params: Promise.resolve({ categoryId }) }
    );
    expect(response.status).toBe(200);
    const budget = await response.json();
    expect(budget.monthlyAmount).toBe("700.00");
  });

  it("aggiorna il budget se esiste già (upsert)", async () => {
    await PUT(
      new NextRequest(`http://localhost/api/budgets/${categoryId}`, {
        method: "PUT",
        body: JSON.stringify({ monthlyAmount: 700 }),
      }),
      { params: Promise.resolve({ categoryId }) }
    );

    const response = await PUT(
      new NextRequest(`http://localhost/api/budgets/${categoryId}`, {
        method: "PUT",
        body: JSON.stringify({ monthlyAmount: 900 }),
      }),
      { params: Promise.resolve({ categoryId }) }
    );
    expect(response.status).toBe(200);
    const budget = await response.json();
    expect(budget.monthlyAmount).toBe("900.00");
  });

  it("risponde 404 su una categoria inesistente/altrui", async () => {
    const response = await PUT(
      new NextRequest(`http://localhost/api/budgets/${crypto.randomUUID()}`, {
        method: "PUT",
        body: JSON.stringify({ monthlyAmount: 100 }),
      }),
      { params: Promise.resolve({ categoryId: crypto.randomUUID() }) }
    );
    expect(response.status).toBe(404);
  });

  it("risponde 404 se si tenta di impostare il budget di una categoria di un altro utente", async () => {
    const response = await PUT(
      new NextRequest(`http://localhost/api/budgets/${otherUserCategoryId}`, {
        method: "PUT",
        body: JSON.stringify({ monthlyAmount: 100 }),
      }),
      { params: Promise.resolve({ categoryId: otherUserCategoryId }) }
    );
    expect(response.status).toBe(404);

    const [budget] = await db
      .select()
      .from(budgets)
      .where(eq(budgets.categoryId, otherUserCategoryId));
    expect(budget).toBeUndefined();
  });
  it("removes the budget of the user's category", async () => {
    await db.insert(budgets).values({ userId, categoryId, monthlyAmount: "300.00" });
    const response = await DELETE(new NextRequest(`http://localhost/api/budgets/${categoryId}`, { method: "DELETE" }), {
      params: Promise.resolve({ categoryId }),
    });
    expect(response.status).toBe(204);
    const rows = await db.select().from(budgets).where(eq(budgets.categoryId, categoryId));
    expect(rows).toHaveLength(0);
  });

  it("answers 204 when there is no budget to remove", async () => {
    const response = await DELETE(new NextRequest(`http://localhost/api/budgets/${categoryId}`, { method: "DELETE" }), {
      params: Promise.resolve({ categoryId }),
    });
    expect(response.status).toBe(204);
  });

  it("never removes another user's budget", async () => {
    await db.insert(budgets).values({ userId: otherUserId, categoryId: otherUserCategoryId, monthlyAmount: "100.00" });
    const response = await DELETE(new NextRequest(`http://localhost/api/budgets/${otherUserCategoryId}`, { method: "DELETE" }), {
      params: Promise.resolve({ categoryId: otherUserCategoryId }),
    });
    expect(response.status).toBe(204);
    const rows = await db.select().from(budgets).where(eq(budgets.categoryId, otherUserCategoryId));
    expect(rows).toHaveLength(1);
    await db.delete(budgets).where(eq(budgets.categoryId, otherUserCategoryId));
  });
  function put(id: string, body: unknown) {
    return PUT(new NextRequest(`http://localhost/api/budgets/${id}`, { method: "PUT", body: JSON.stringify(body) }), { params: Promise.resolve({ categoryId: id }) });
  }

  it("turns rollover on by itself for a new occasional budget, from the current month", async () => {
    const [gifts] = await db.insert(categories).values({ userId, name: "Regali", type: "saltuaria" }).returning();
    const budget = await (await put(gifts.id, { monthlyAmount: 45 })).json();
    expect(budget).toMatchObject({ rollover: true, rolloverFrom: monthKey(new Date()) });
    const monthly = await (await put(categoryId, { monthlyAmount: 700 })).json();
    expect(monthly).toMatchObject({ rollover: false, rolloverFrom: null });
  });

  it("keeps the old amount for past months when the budget changes", async () => {
    const created = new Date();
    created.setMonth(created.getMonth() - 3, 1);
    await db.insert(budgets).values({ userId, categoryId, monthlyAmount: "400.00", createdAt: created });
    await put(categoryId, { monthlyAmount: 450 });
    const rows = await db.select().from(budgetMonths).where(eq(budgetMonths.categoryId, categoryId));
    expect(rows.map((r) => [r.month, r.amount]).sort()).toEqual([
      [monthKey(created), "400.00"],
      [monthKey(new Date()), "450.00"],
    ]);
  });

  it("sets and removes the amount of one month only, never of a past month", async () => {
    await put(categoryId, { monthlyAmount: 700 });
    const next = shiftMonth(monthKey(new Date()), 1);
    expect((await put(categoryId, { singleMonth: { month: next, amount: 900 } })).status).toBe(200);
    expect(await db.select().from(budgetMonths).where(eq(budgetMonths.categoryId, categoryId))).toHaveLength(1);
    await put(categoryId, { singleMonth: { month: next, amount: null } });
    expect(await db.select().from(budgetMonths).where(eq(budgetMonths.categoryId, categoryId))).toHaveLength(0);
    const past = await put(categoryId, { singleMonth: { month: shiftMonth(monthKey(new Date()), -1), amount: 900 } });
    expect(past.status).toBe(400);
  });

  it("answers 404 when rollover is changed on a category without a budget", async () => {
    const response = await put(categoryId, { rollover: true });
    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe("budget_not_found");
  });

  it("switching rollover off and on again starts carrying from the current month", async () => {
    await db.insert(budgets).values({ userId, categoryId, monthlyAmount: "100.00", rollover: true, rolloverFrom: "2025-01" });
    await put(categoryId, { rollover: false });
    const budget = await (await put(categoryId, { rollover: true })).json();
    expect(budget.rolloverFrom).toBe(monthKey(new Date()));
  });

  it("refuses an empty change", async () => {
    expect((await put(categoryId, {})).status).toBe(400);
  });
});
