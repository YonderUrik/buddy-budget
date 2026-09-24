import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
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
import { POST } from "./route";

const mockedGetSession = vi.mocked(auth.api.getSession);

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/transactions/categorize-apply", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/transactions/categorize-apply", () => {
  let userId: string;
  let otherUserId: string;
  let accountId: string;
  let otherAccountId: string;
  let expenseCategoryId: string;
  let incomeCategoryId: string;
  let otherUserCategoryId: string;

  beforeEach(async () => {
    const testId = `test-categorize-apply-${crypto.randomUUID()}`;
    const [user] = await db
      .insert(authUser)
      .values({
        id: testId,
        name: "Test User",
        email: `test-categorize-apply-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    userId = user.id;

    const otherId = `test-categorize-apply-other-${crypto.randomUUID()}`;
    const [otherUser] = await db
      .insert(authUser)
      .values({
        id: otherId,
        name: "Other User",
        email: `test-categorize-apply-other-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    otherUserId = otherUser.id;

    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);

    const [account] = await db
      .insert(accounts)
      .values({ userId, name: "Contanti", type: "Contanti", balance: "0.00" })
      .returning();
    accountId = account.id;

    const [otherAccount] = await db
      .insert(accounts)
      .values({ userId: otherUserId, name: "Contanti", type: "Contanti", balance: "0.00" })
      .returning();
    otherAccountId = otherAccount.id;

    const [expenseCategory] = await db
      .insert(categories)
      .values({ userId, name: "Spesa alimentare", type: "voluta" })
      .returning();
    expenseCategoryId = expenseCategory.id;

    const [incomeCategory] = await db
      .insert(categories)
      .values({ userId, name: "Stipendio", type: "entrata" })
      .returning();
    incomeCategoryId = incomeCategory.id;

    const [otherUserCategory] = await db
      .insert(categories)
      .values({ userId: otherUserId, name: "Categoria altrui", type: "voluta" })
      .returning();
    otherUserCategoryId = otherUserCategory.id;
  });

  afterEach(async () => {
    // otherUserId prima: le sue transazioni referenziano categoria/conto propri, ma anche il test
    // "non applica niente" incrocia una transazione altrui — stesso ordine di [id]/route.test.ts.
    await db.delete(authUser).where(eq(authUser.id, otherUserId));
    await db.delete(authUser).where(eq(authUser.id, userId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("risponde 401 senza sessione", async () => {
    mockedGetSession.mockResolvedValueOnce(null as never);

    const response = await POST(
      makeRequest({ groups: [{ transactionIds: ["11111111-1111-4111-8111-111111111111"], categoryId: expenseCategoryId, merchantKey: "x" }] })
    );

    expect(response.status).toBe(401);
  });

  it("categorizza tutte le transazioni del gruppo in una sola chiamata", async () => {
    const [oldCategory] = await db
      .insert(categories)
      .values({ userId, name: "Da categorizzare", type: "voluta", isFallback: true })
      .returning();

    const inserted = await db
      .insert(transactions)
      .values([
        { userId, accountId, categoryId: oldCategory.id, description: "Esselunga 1", amount: "-10.00", date: "2026-02-01", source: "manuale" },
        { userId, accountId, categoryId: oldCategory.id, description: "Esselunga 2", amount: "-20.00", date: "2026-02-02", source: "manuale" },
        { userId, accountId, categoryId: oldCategory.id, description: "Esselunga 3", amount: "-30.00", date: "2026-02-03", source: "manuale" },
      ])
      .returning();

    const response = await POST(
      makeRequest({
        groups: [
          {
            transactionIds: inserted.map((t) => t.id),
            categoryId: expenseCategoryId,
            merchantKey: "esselunga",
            createRule: false,
          },
        ],
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ applied: 3, rulesCreated: 0 });

    const updated = await db
      .select()
      .from(transactions)
      .where(inArray(transactions.id, inserted.map((t) => t.id)));
    expect(updated.every((t) => t.categoryId === expenseCategoryId)).toBe(true);
  });

  it("crea la regola merchant quando createRule è true", async () => {
    const [transaction] = await db
      .insert(transactions)
      .values({ userId, accountId, categoryId: expenseCategoryId, description: "Esselunga", amount: "-10.00", date: "2026-02-01", source: "manuale" })
      .returning();

    const response = await POST(
      makeRequest({
        groups: [{ transactionIds: [transaction.id], categoryId: expenseCategoryId, merchantKey: "esselunga", createRule: true }],
      })
    );

    const { rulesCreated } = await response.json();
    expect(rulesCreated).toBe(1);

    const [rule] = await db.select().from(categorizationRules).where(eq(categorizationRules.userId, userId));
    expect(rule.matchType).toBe("merchant");
    expect(rule.pattern).toBe("esselunga");
    expect(rule.source).toBe("appresa");
  });

  it("non crea la regola quando createRule è false", async () => {
    const [transaction] = await db
      .insert(transactions)
      .values({ userId, accountId, categoryId: expenseCategoryId, description: "Esselunga", amount: "-10.00", date: "2026-02-01", source: "manuale" })
      .returning();

    const response = await POST(
      makeRequest({
        groups: [{ transactionIds: [transaction.id], categoryId: expenseCategoryId, merchantKey: "esselunga", createRule: false }],
      })
    );

    const { rulesCreated } = await response.json();
    expect(rulesCreated).toBe(0);

    const rules = await db.select().from(categorizationRules).where(eq(categorizationRules.userId, userId));
    expect(rules).toHaveLength(0);
  });

  it("aggiorna la regola esistente invece di duplicarla", async () => {
    const [otherExpenseCategory] = await db
      .insert(categories)
      .values({ userId, name: "Ristoranti", type: "voluta" })
      .returning();

    const [transaction1] = await db
      .insert(transactions)
      .values({ userId, accountId, categoryId: expenseCategoryId, description: "Esselunga", amount: "-10.00", date: "2026-02-01", source: "manuale" })
      .returning();

    await POST(
      makeRequest({
        groups: [{ transactionIds: [transaction1.id], categoryId: expenseCategoryId, merchantKey: "esselunga", createRule: true }],
      })
    );

    const [transaction2] = await db
      .insert(transactions)
      .values({ userId, accountId, categoryId: expenseCategoryId, description: "Esselunga", amount: "-15.00", date: "2026-02-05", source: "manuale" })
      .returning();

    const response = await POST(
      makeRequest({
        groups: [{ transactionIds: [transaction2.id], categoryId: otherExpenseCategory.id, merchantKey: "esselunga", createRule: true }],
      })
    );

    expect((await response.json()).rulesCreated).toBe(0);

    const rules = await db.select().from(categorizationRules).where(eq(categorizationRules.userId, userId));
    expect(rules).toHaveLength(1);
    expect(rules[0].categoryId).toBe(otherExpenseCategory.id);
  });

  it("applica la quota esclusa proporzionalmente a ogni transazione del gruppo", async () => {
    const inserted = await db
      .insert(transactions)
      .values([
        { userId, accountId, categoryId: expenseCategoryId, description: "Esselunga 1", amount: "-100.00", date: "2026-02-01", source: "manuale" },
        { userId, accountId, categoryId: expenseCategoryId, description: "Esselunga 2", amount: "-50.00", date: "2026-02-02", source: "manuale" },
      ])
      .returning();

    const response = await POST(
      makeRequest({
        groups: [
          {
            transactionIds: inserted.map((t) => t.id),
            categoryId: expenseCategoryId,
            merchantKey: "esselunga",
            excludedPercentage: 0.5,
            createRule: false,
          },
        ],
      })
    );

    expect(response.status).toBe(200);

    const updated = await db
      .select()
      .from(transactions)
      .where(inArray(transactions.id, inserted.map((t) => t.id)))
      .orderBy(transactions.date);
    expect(updated[0].excludedAmount).toBe("-50.00");
    expect(updated[1].excludedAmount).toBe("-25.00");
  });

  it("rifiuta con 400 una categoria incompatibile con la direzione di una transazione del gruppo", async () => {
    const [transaction] = await db
      .insert(transactions)
      .values({ userId, accountId, categoryId: expenseCategoryId, description: "Spesa", amount: "-10.00", date: "2026-02-01", source: "manuale" })
      .returning();

    const response = await POST(
      makeRequest({
        groups: [{ transactionIds: [transaction.id], categoryId: incomeCategoryId, merchantKey: "x" }],
      })
    );

    expect(response.status).toBe(400);

    const [unchanged] = await db.select().from(transactions).where(eq(transactions.id, transaction.id));
    expect(unchanged.categoryId).toBe(expenseCategoryId);
  });

  it("non applica niente se una sola transazione del gruppo non è dell'utente", async () => {
    const [ownTransaction1] = await db
      .insert(transactions)
      .values({ userId, accountId, categoryId: expenseCategoryId, description: "Spesa 1", amount: "-10.00", date: "2026-02-01", source: "manuale" })
      .returning();
    const [ownTransaction2] = await db
      .insert(transactions)
      .values({ userId, accountId, categoryId: expenseCategoryId, description: "Spesa 2", amount: "-20.00", date: "2026-02-02", source: "manuale" })
      .returning();
    const [otherTransaction] = await db
      .insert(transactions)
      .values({ userId: otherUserId, accountId: otherAccountId, categoryId: otherUserCategoryId, description: "Spesa altrui", amount: "-30.00", date: "2026-02-03", source: "manuale" })
      .returning();

    const response = await POST(
      makeRequest({
        groups: [
          {
            transactionIds: [ownTransaction1.id, ownTransaction2.id, otherTransaction.id],
            categoryId: expenseCategoryId,
            merchantKey: "x",
          },
        ],
      })
    );

    expect(response.status).toBe(404);

    const [unchanged1] = await db.select().from(transactions).where(eq(transactions.id, ownTransaction1.id));
    const [unchanged2] = await db.select().from(transactions).where(eq(transactions.id, ownTransaction2.id));
    expect(unchanged1.categoryId).toBe(expenseCategoryId);
    expect(unchanged2.categoryId).toBe(expenseCategoryId);
  });
});
