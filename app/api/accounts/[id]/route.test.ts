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
import { PATCH, DELETE } from "./route";

const mockedGetSession = vi.mocked(auth.api.getSession);

describe("PATCH/DELETE /api/accounts/[id]", () => {
  let userId: string;
  let otherUserId: string;

  beforeEach(async () => {
    const testId = `test-account-id-${crypto.randomUUID()}`;
    const [user] = await db
      .insert(authUser)
      .values({
        id: testId,
        name: "Test User",
        email: `test-account-id-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    userId = user.id;

    const otherId = `test-account-id-other-${crypto.randomUUID()}`;
    const [otherUser] = await db
      .insert(authUser)
      .values({
        id: otherId,
        name: "Other User",
        email: `test-account-id-other-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    otherUserId = otherUser.id;

    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
    await db.delete(authUser).where(eq(authUser.id, otherUserId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("aggiorna un conto manuale del proprio utente", async () => {
    const [account] = await db
      .insert(accounts)
      .values({ userId, name: "Conto corrente", type: "Conto corrente", balance: "100.00" })
      .returning();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/accounts/${account.id}`, {
        method: "PATCH",
        body: JSON.stringify({ balance: 250 }),
      }),
      { params: Promise.resolve({ id: account.id }) }
    );

    expect(response.status).toBe(200);
    const updated = await response.json();
    expect(updated.balance).toBe("250.00");
  });

  it("risponde 403 se il conto è auto", async () => {
    const [account] = await db
      .insert(accounts)
      .values({ userId, name: "Conto auto", type: "Conto corrente", balance: "100.00", source: "auto" })
      .returning();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/accounts/${account.id}`, {
        method: "PATCH",
        body: JSON.stringify({ balance: 250 }),
      }),
      { params: Promise.resolve({ id: account.id }) }
    );

    expect(response.status).toBe(403);
  });

  it("risponde 404 su un conto di un altro utente", async () => {
    const [otherAccount] = await db
      .insert(accounts)
      .values({ userId: otherUserId, name: "Conto altrui", type: "Conto corrente", balance: "100.00" })
      .returning();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/accounts/${otherAccount.id}`, {
        method: "PATCH",
        body: JSON.stringify({ balance: 250 }),
      }),
      { params: Promise.resolve({ id: otherAccount.id }) }
    );

    expect(response.status).toBe(404);
  });

  it("elimina (o scollega) un conto, manuale o auto", async () => {
    const [account] = await db
      .insert(accounts)
      .values({ userId, name: "Conto da eliminare", type: "Contanti", balance: "10.00", source: "auto" })
      .returning();

    const response = await DELETE(
      new NextRequest(`http://localhost/api/accounts/${account.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: account.id }) }
    );

    expect(response.status).toBe(204);

    const remaining = await db.select().from(accounts).where(eq(accounts.id, account.id));
    expect(remaining).toHaveLength(0);
  });

  it("elimina un conto 'auto' anche se ha transazioni sincronizzate", async () => {
    const [account] = await db
      .insert(accounts)
      .values({ userId, name: "Conto Auto", type: "Conto corrente", balance: "50.00", source: "auto" })
      .returning();
    const [category] = await db
      .insert(categories)
      .values({ userId, name: "Da categorizzare", type: "variabile" })
      .returning();
    await db.insert(transactions).values({
      userId,
      accountId: account.id,
      categoryId: category.id,
      description: "Movimento sincronizzato",
      amount: "-20.00",
      date: "2026-07-01",
      source: "auto",
      externalId: "ext-1",
    });

    const response = await DELETE(
      new NextRequest(`http://localhost/api/accounts/${account.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: account.id }) }
    );

    expect(response.status).toBe(204);

    const remainingAccounts = await db.select().from(accounts).where(eq(accounts.id, account.id));
    expect(remainingAccounts).toHaveLength(0);

    const remainingTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.accountId, account.id));
    expect(remainingTransactions).toHaveLength(0);
  });
});
