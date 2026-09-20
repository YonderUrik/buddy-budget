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

vi.mock("@/lib/categorization/llm", () => ({
  getSuggester: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { getSuggester } from "@/lib/categorization/llm";
import { POST } from "./route";

const mockedGetSession = vi.mocked(auth.api.getSession);
const mockedGetSuggester = vi.mocked(getSuggester);

function postRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/transactions/categorize-suggestions/ai", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/transactions/categorize-suggestions/ai", () => {
  let userId: string;
  let accountId: string;
  let fallbackCategoryId: string;
  let foodCategoryId: string;
  let otherUserId: string;
  let otherAccountId: string;
  let otherCategoryId: string;
  let otherTransactionId: string;

  beforeEach(async () => {
    mockedGetSuggester.mockReset();

    const testId = `test-categorize-suggestions-ai-${crypto.randomUUID()}`;
    const [user] = await db
      .insert(authUser)
      .values({
        id: testId,
        name: "Test User",
        email: `test-categorize-suggestions-ai-${Date.now()}@example.com`,
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

    await db.insert(categories).values({ userId, name: "Stipendio", type: "entrata" });

    const otherTestId = `test-categorize-suggestions-ai-other-${crypto.randomUUID()}`;
    const [otherUser] = await db
      .insert(authUser)
      .values({
        id: otherTestId,
        name: "Other Test User",
        email: `test-categorize-suggestions-ai-other-${Date.now()}@example.com`,
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

    const [otherTransaction] = await db
      .insert(transactions)
      .values({
        userId: otherUserId,
        accountId: otherAccountId,
        categoryId: otherCategoryId,
        description: "Bar Centrale",
        amount: "-5.00",
        date: "2026-02-01",
        source: "manuale",
      })
      .returning();
    otherTransactionId = otherTransaction.id;
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
    const response = await POST(postRequest({ transactionIds: [] }));
    expect(response.status).toBe(401);
  });

  it("risponde 200 con lista vuota quando nessun modello è configurato", async () => {
    mockedGetSuggester.mockReturnValue(null);

    const [transaction] = await db
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

    const response = await POST(postRequest({ transactionIds: [transaction.id] }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ groups: [] });
  });

  it("risponde 404 se una transazione non è dell'utente", async () => {
    mockedGetSuggester.mockReturnValue(null);
    const response = await POST(postRequest({ transactionIds: [otherTransactionId] }));
    expect(response.status).toBe(404);
  });

  it("mappa una proposta valida sulla categoria corrispondente", async () => {
    mockedGetSuggester.mockReturnValue({
      suggest: vi.fn().mockResolvedValue([{ index: 0, categoryName: "Spesa alimentare", confidence: 0.75 }]),
    });

    const [transaction] = await db
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

    const response = await POST(postRequest({ transactionIds: [transaction.id] }));
    expect(response.status).toBe(200);
    const { groups } = await response.json();
    expect(groups).toHaveLength(1);
    expect(groups[0].suggestion).toMatchObject({
      suggestedCategoryId: foodCategoryId,
      source: "assistente",
      confidence: 0.75,
    });
  });

  it("scarta una proposta incompatibile con la direzione della transazione", async () => {
    mockedGetSuggester.mockReturnValue({
      // Il modello propone "Stipendio" (entrata) per una spesa (importo negativo): incompatibile.
      suggest: vi.fn().mockResolvedValue([{ index: 0, categoryName: "Stipendio", confidence: 0.9 }]),
    });

    const [transaction] = await db
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

    const response = await POST(postRequest({ transactionIds: [transaction.id] }));
    expect(response.status).toBe(200);
    const { groups } = await response.json();
    expect(groups).toHaveLength(1);
    expect(groups[0].suggestion).toBeNull();
  });
});
