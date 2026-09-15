import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { accounts } from "@/lib/db/schema/accounts";
import { categories } from "@/lib/db/schema/categories";
import { categorizationRules } from "@/lib/db/schema/categorization-rules";
import { transactions } from "@/lib/db/schema/transactions";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { GET } from "./route";

const mockedGetSession = vi.mocked(auth.api.getSession);

describe("GET /api/transactions/categorize-suggestions", () => {
  let userId: string;
  let accountId: string;
  let fallbackCategoryId: string;
  let foodCategoryId: string;
  let otherUserId: string;
  let otherAccountId: string;
  let otherCategoryId: string;

  beforeEach(async () => {
    const testId = `test-categorize-suggestions-${crypto.randomUUID()}`;
    const [user] = await db
      .insert(authUser)
      .values({
        id: testId,
        name: "Test User",
        email: `test-categorize-suggestions-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    userId = user.id;
    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);

    const [account] = await db
      .insert(accounts)
      .values({ userId, name: "Contanti", type: "Contanti", balance: "0.00" })
      .returning();
    accountId = account.id;

    const [fallbackCategory] = await db
      .insert(categories)
      .values({ userId, name: "Da categorizzare", type: "variabile", isFallback: true })
      .returning();
    fallbackCategoryId = fallbackCategory.id;

    const [foodCategory] = await db
      .insert(categories)
      .values({ userId, name: "Spesa alimentare", type: "variabile" })
      .returning();
    foodCategoryId = foodCategory.id;

    const otherTestId = `test-categorize-suggestions-other-${crypto.randomUUID()}`;
    const [otherUser] = await db
      .insert(authUser)
      .values({
        id: otherTestId,
        name: "Other Test User",
        email: `test-categorize-suggestions-other-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    otherUserId = otherUser.id;

    const [otherAccount] = await db
      .insert(accounts)
      .values({ userId: otherUserId, name: "Contanti Altro", type: "Contanti", balance: "0.00" })
      .returning();
    otherAccountId = otherAccount.id;

    const [otherCategory] = await db
      .insert(categories)
      .values({ userId: otherUserId, name: "Da categorizzare", type: "variabile", isFallback: true })
      .returning();
    otherCategoryId = otherCategory.id;
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
    await db.delete(authUser).where(eq(authUser.id, otherUserId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("risponde 401 senza sessione", async () => {
    mockedGetSession.mockResolvedValueOnce(null as never);
    const response = await GET(new NextRequest("http://localhost/api/transactions/categorize-suggestions"));
    expect(response.status).toBe(401);
  });

  it("raggruppa le transazioni da categorizzare per chiave merchant", async () => {
    const [first] = await db
      .insert(transactions)
      .values({
        userId,
        accountId,
        categoryId: fallbackCategoryId,
        description: "Esselunga Via Roma 4471",
        amount: "-25.00",
        date: "2026-02-01",
        source: "manuale",
      })
      .returning();
    const [second] = await db
      .insert(transactions)
      .values({
        userId,
        accountId,
        categoryId: fallbackCategoryId,
        description: "ESSELUNGA VIA ROMA 8832",
        amount: "-18.50",
        date: "2026-02-05",
        source: "manuale",
      })
      .returning();

    const response = await GET(new NextRequest("http://localhost/api/transactions/categorize-suggestions"));
    expect(response.status).toBe(200);
    const { groups } = await response.json();
    expect(groups).toHaveLength(1);
    expect(groups[0].transactionIds).toHaveLength(2);
    expect(groups[0].transactionIds.sort()).toEqual([first.id, second.id].sort());
  });

  it("include la proposta ricavata da una regola esistente", async () => {
    await db.insert(categorizationRules).values({
      userId,
      matchType: "merchant",
      pattern: "esselunga via roma",
      categoryId: foodCategoryId,
    });

    await db.insert(transactions).values({
      userId,
      accountId,
      categoryId: fallbackCategoryId,
      description: "Esselunga Via Roma 4471",
      amount: "-25.00",
      date: "2026-02-01",
      source: "manuale",
    });

    const { groups } = await (await GET(new NextRequest("http://localhost/api/transactions/categorize-suggestions"))).json();
    expect(groups).toHaveLength(1);
    expect(groups[0].suggestion.source).toBe("regola");
    expect(groups[0].suggestion.suggestedCategoryId).toBe(foodCategoryId);
  });

  it("non include le transazioni di altri utenti", async () => {
    await db.insert(transactions).values({
      userId: otherUserId,
      accountId: otherAccountId,
      categoryId: otherCategoryId,
      description: "Bar Centrale",
      amount: "-5.00",
      date: "2026-02-01",
      source: "manuale",
    });

    const { groups } = await (await GET(new NextRequest("http://localhost/api/transactions/categorize-suggestions"))).json();
    expect(groups).toEqual([]);
  });
});
