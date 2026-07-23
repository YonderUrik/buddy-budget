import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { accounts } from "@/lib/db/schema/accounts";
import { categories } from "@/lib/db/schema/categories";
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
      .values({ userId: otherUserId, name: "Categoria altro utente", type: "variabile" })
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

  it("suggerisce la categoria storica per una transazione da categorizzare con descrizione già vista", async () => {
    await db.insert(transactions).values({
      userId,
      accountId,
      categoryId: foodCategoryId,
      description: "Esselunga",
      amount: "-30.00",
      date: "2026-01-05",
      source: "manuale",
    });
    const [uncategorized] = await db
      .insert(transactions)
      .values({
        userId,
        accountId,
        categoryId: fallbackCategoryId,
        description: "esselunga",
        amount: "-25.00",
        date: "2026-02-01",
        source: "manuale",
      })
      .returning();

    const response = await GET(new NextRequest("http://localhost/api/transactions/categorize-suggestions"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0].transaction.id).toBe(uncategorized.id);
    expect(body[0].suggestedCategoryId).toBe(foodCategoryId);
  });

  it("esclude le transazioni senza nessun match storico", async () => {
    await db.insert(transactions).values({
      userId,
      accountId,
      categoryId: fallbackCategoryId,
      description: "Merchant mai visto prima",
      amount: "-10.00",
      date: "2026-02-01",
      source: "manuale",
    });

    const response = await GET(new NextRequest("http://localhost/api/transactions/categorize-suggestions"));
    const body = await response.json();
    expect(body).toHaveLength(0);
  });

  it("non usa transazioni categorizzate di un altro utente come storico", async () => {
    await db.insert(transactions).values({
      userId: otherUserId,
      accountId: otherAccountId,
      categoryId: otherCategoryId,
      description: "Bar Centrale",
      amount: "-5.00",
      date: "2026-01-01",
      source: "manuale",
    });
    await db.insert(transactions).values({
      userId,
      accountId,
      categoryId: fallbackCategoryId,
      description: "Bar Centrale",
      amount: "-5.00",
      date: "2026-02-01",
      source: "manuale",
    });

    const response = await GET(new NextRequest("http://localhost/api/transactions/categorize-suggestions"));
    const body = await response.json();
    expect(body).toHaveLength(0);
  });
});
