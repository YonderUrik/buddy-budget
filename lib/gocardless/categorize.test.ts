import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { accounts } from "@/lib/db/schema/accounts";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";
import { FALLBACK_CATEGORY_NAME, getFallbackCategoryId, resolveCategoryId } from "./categorize";

describe("categorize", () => {
  let userId: string;

  afterAll(async () => {
    if (userId) await db.delete(authUser).where(eq(authUser.id, userId));
    await client.end();
  });

  it("riusa la categoria di una transazione precedente con stessa descrizione (case-insensitive)", async () => {
    const testId = `test-categorize-${crypto.randomUUID()}`;
    const [user] = await db
      .insert(authUser)
      .values({
        id: testId,
        name: "Test Categorize",
        email: `test-categorize-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    userId = user.id;

    const [category] = await db
      .insert(categories)
      .values({ userId, name: "Abbonamenti", type: "fissa" })
      .returning();
    const [account] = await db
      .insert(accounts)
      .values({ userId, name: "Conto", type: "Conto corrente", balance: "0" })
      .returning();
    await db.insert(transactions).values({
      userId,
      accountId: account.id,
      categoryId: category.id,
      description: "Netflix",
      amount: "-12.99",
      date: "2026-07-01",
    });

    const matched = await resolveCategoryId(userId, "netflix");
    expect(matched).toBe(category.id);
  });

  it("crea e riusa la categoria di fallback quando non trova match", async () => {
    const fallbackId1 = await getFallbackCategoryId(userId);
    const fallbackId2 = await getFallbackCategoryId(userId);
    expect(fallbackId1).toBe(fallbackId2);

    const [fallbackCategory] = await db.select().from(categories).where(eq(categories.id, fallbackId1));
    expect(fallbackCategory.name).toBe(FALLBACK_CATEGORY_NAME);

    const resolved = await resolveCategoryId(userId, "Descrizione mai vista prima");
    expect(resolved).toBe(fallbackId1);
  });
});
