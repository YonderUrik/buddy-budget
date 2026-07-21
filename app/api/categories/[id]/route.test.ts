import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { categories } from "@/lib/db/schema/categories";
import { budgets } from "@/lib/db/schema/budgets";
import { transactions } from "@/lib/db/schema/transactions";
import { accounts } from "@/lib/db/schema/accounts";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { PATCH, DELETE } from "./route";

const mockedGetSession = vi.mocked(auth.api.getSession);

describe("PATCH/DELETE /api/categories/[id]", () => {
  let userId: string;
  let otherUserId: string;
  let fallbackCategoryId: string;

  beforeEach(async () => {
    const testId = `test-category-id-${crypto.randomUUID()}`;
    const [user] = await db
      .insert(authUser)
      .values({
        id: testId,
        name: "Test User",
        email: `test-category-id-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    userId = user.id;

    const otherId = `test-category-id-other-${crypto.randomUUID()}`;
    const [otherUser] = await db
      .insert(authUser)
      .values({
        id: otherId,
        name: "Other User",
        email: `test-category-id-other-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    otherUserId = otherUser.id;

    const [fallback] = await db
      .insert(categories)
      .values({ userId, name: "Da categorizzare", type: "variabile", isFallback: true })
      .returning();
    fallbackCategoryId = fallback.id;

    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
    await db.delete(authUser).where(eq(authUser.id, otherUserId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("rinomina una categoria propria", async () => {
    const [category] = await db
      .insert(categories)
      .values({ userId, name: "Svago", type: "variabile" })
      .returning();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/categories/${category.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: "Tempo libero" }),
      }),
      { params: Promise.resolve({ id: category.id }) }
    );

    expect(response.status).toBe(200);
    const updated = await response.json();
    expect(updated.name).toBe("Tempo libero");
  });

  it("aggiorna icona/colore di una categoria propria", async () => {
    const [category] = await db
      .insert(categories)
      .values({ userId, name: "Svago", type: "variabile" })
      .returning();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/categories/${category.id}`, {
        method: "PATCH",
        body: JSON.stringify({ icon: "music", color: "purple" }),
      }),
      { params: Promise.resolve({ id: category.id }) }
    );

    expect(response.status).toBe(200);
    const updated = await response.json();
    expect(updated.icon).toBe("music");
    expect(updated.color).toBe("purple");
  });

  it("risponde 409 rinominando su un nome già usato dallo stesso utente", async () => {
    await db.insert(categories).values({ userId, name: "Trasporti", type: "variabile" });
    const [category] = await db
      .insert(categories)
      .values({ userId, name: "Svago", type: "variabile" })
      .returning();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/categories/${category.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: "Trasporti" }),
      }),
      { params: Promise.resolve({ id: category.id }) }
    );

    expect(response.status).toBe(409);
  });

  it("risponde 404 aggiornando una categoria di un altro utente", async () => {
    const [otherCategory] = await db
      .insert(categories)
      .values({ userId: otherUserId, name: "Categoria altrui", type: "variabile" })
      .returning();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/categories/${otherCategory.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: "Hackerata" }),
      }),
      { params: Promise.resolve({ id: otherCategory.id }) }
    );

    expect(response.status).toBe(404);
  });

  it("elimina una categoria senza transazioni collegate", async () => {
    const [category] = await db
      .insert(categories)
      .values({ userId, name: "Svago", type: "variabile" })
      .returning();

    const response = await DELETE(
      new NextRequest(`http://localhost/api/categories/${category.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: category.id }) }
    );

    expect(response.status).toBe(204);
    const remaining = await db.select().from(categories).where(eq(categories.id, category.id));
    expect(remaining).toHaveLength(0);
  });

  it("riassegna transazioni ed elimina il budget quando elimina una categoria in uso", async () => {
    const [account] = await db
      .insert(accounts)
      .values({ userId, name: "Conto", type: "Conto corrente", balance: "0" })
      .returning();
    const [category] = await db
      .insert(categories)
      .values({ userId, name: "Svago", type: "variabile" })
      .returning();
    await db.insert(budgets).values({ userId, categoryId: category.id, monthlyAmount: "100.00" });
    const [transaction] = await db
      .insert(transactions)
      .values({
        userId,
        accountId: account.id,
        categoryId: category.id,
        description: "Cinema",
        amount: "-15.00",
        date: "2026-07-01",
      })
      .returning();

    const response = await DELETE(
      new NextRequest(`http://localhost/api/categories/${category.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: category.id }) }
    );

    expect(response.status).toBe(204);

    const remainingBudgets = await db.select().from(budgets).where(eq(budgets.categoryId, category.id));
    expect(remainingBudgets).toHaveLength(0);

    const [reassigned] = await db.select().from(transactions).where(eq(transactions.id, transaction.id));
    expect(reassigned.categoryId).toBe(fallbackCategoryId);
  });

  it("risponde 409 eliminando la categoria fallback", async () => {
    const response = await DELETE(
      new NextRequest(`http://localhost/api/categories/${fallbackCategoryId}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: fallbackCategoryId }) }
    );

    expect(response.status).toBe(409);
    const remaining = await db.select().from(categories).where(eq(categories.id, fallbackCategoryId));
    expect(remaining).toHaveLength(1);
  });

  it("risponde 404 eliminando una categoria di un altro utente", async () => {
    const [otherCategory] = await db
      .insert(categories)
      .values({ userId: otherUserId, name: "Categoria altrui", type: "variabile" })
      .returning();

    const response = await DELETE(
      new NextRequest(`http://localhost/api/categories/${otherCategory.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: otherCategory.id }) }
    );

    expect(response.status).toBe(404);
  });
});
