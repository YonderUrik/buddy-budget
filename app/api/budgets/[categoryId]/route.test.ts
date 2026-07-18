import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { categories } from "@/lib/db/schema/categories";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { PUT } from "./route";

const mockedGetSession = vi.mocked(auth.api.getSession);

describe("PUT /api/budgets/[categoryId]", () => {
  let userId: string;
  let categoryId: string;

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
      .values({ userId, name: "Affitto", type: "fissa" })
      .returning();
    categoryId = category.id;
  });

  afterEach(async () => {
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
});
