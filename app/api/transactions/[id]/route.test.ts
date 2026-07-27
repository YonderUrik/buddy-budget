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

describe("PATCH/DELETE /api/transactions/[id]", () => {
  let userId: string;
  let otherUserId: string;
  let accountId: string;
  let categoryId: string;
  let otherCategoryId: string;
  let otherUserCategoryId: string;

  beforeEach(async () => {
    const testId = `test-transaction-id-${crypto.randomUUID()}`;
    const [user] = await db
      .insert(authUser)
      .values({
        id: testId,
        name: "Test User",
        email: `test-transaction-id-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    userId = user.id;

    const otherId = `test-transaction-id-other-${crypto.randomUUID()}`;
    const [otherUser] = await db
      .insert(authUser)
      .values({
        id: otherId,
        name: "Other User",
        email: `test-transaction-id-other-${Date.now()}@example.com`,
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

    const [category] = await db
      .insert(categories)
      .values({ userId, name: "Spesa alimentare", type: "variabile" })
      .returning();
    categoryId = category.id;

    const [otherCategory] = await db
      .insert(categories)
      .values({ userId, name: "Svago", type: "variabile" })
      .returning();
    otherCategoryId = otherCategory.id;

    const [otherUserCategory] = await db
      .insert(categories)
      .values({ userId: otherUserId, name: "Categoria altrui", type: "variabile" })
      .returning();
    otherUserCategoryId = otherUserCategory.id;
  });

  afterEach(async () => {
    // otherUserId prima: la sua transazione ("404 su un altro utente") referenzia categoria/conto
    // di userId, quindi va rimossa (cascade da authUser) prima di eliminare quella categoria/conto.
    await db.delete(authUser).where(eq(authUser.id, otherUserId));
    await db.delete(authUser).where(eq(authUser.id, userId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("aggiorna descrizione/importo/data di una transazione manuale", async () => {
    const [transaction] = await db
      .insert(transactions)
      .values({
        userId,
        accountId,
        categoryId,
        description: "Spesa",
        amount: "-50.00",
        date: "2026-02-10",
        source: "manuale",
      })
      .returning();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/transactions/${transaction.id}`, {
        method: "PATCH",
        body: JSON.stringify({ description: "Spesa corretta", amount: 60, categoryId: otherCategoryId }),
      }),
      { params: Promise.resolve({ id: transaction.id }) }
    );

    expect(response.status).toBe(200);
    const updated = await response.json();
    expect(updated.description).toBe("Spesa corretta");
    expect(updated.amount).toBe("-60.00");
    expect(updated.categoryId).toBe(otherCategoryId);
  });

  it("risponde 403 se si tenta di modificare descrizione/importo/data di una transazione auto", async () => {
    const [transaction] = await db
      .insert(transactions)
      .values({
        userId,
        accountId,
        categoryId,
        description: "Movimento sincronizzato",
        amount: "-50.00",
        date: "2026-02-10",
        source: "auto",
        externalId: "ext-1",
      })
      .returning();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/transactions/${transaction.id}`, {
        method: "PATCH",
        body: JSON.stringify({ description: "Modifica non permessa" }),
      }),
      { params: Promise.resolve({ id: transaction.id }) }
    );

    expect(response.status).toBe(403);
  });

  it("permette di cambiare categoria e 'dividi' su una transazione auto", async () => {
    const [transaction] = await db
      .insert(transactions)
      .values({
        userId,
        accountId,
        categoryId,
        description: "Movimento sincronizzato",
        amount: "-100.00",
        date: "2026-02-10",
        source: "auto",
        externalId: "ext-2",
      })
      .returning();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/transactions/${transaction.id}`, {
        method: "PATCH",
        body: JSON.stringify({ categoryId: otherCategoryId, excludedAmount: 30 }),
      }),
      { params: Promise.resolve({ id: transaction.id }) }
    );

    expect(response.status).toBe(200);
    const updated = await response.json();
    expect(updated.categoryId).toBe(otherCategoryId);
    expect(updated.excludedAmount).toBe("-30.00");
  });

  it("permette di impostare una nota su una transazione manuale", async () => {
    const [transaction] = await db
      .insert(transactions)
      .values({
        userId,
        accountId,
        categoryId,
        description: "Spesa",
        amount: "-50.00",
        date: "2026-02-10",
        source: "manuale",
      })
      .returning();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/transactions/${transaction.id}`, {
        method: "PATCH",
        body: JSON.stringify({ note: "Regalo per Marco" }),
      }),
      { params: Promise.resolve({ id: transaction.id }) }
    );

    expect(response.status).toBe(200);
    const updated = await response.json();
    expect(updated.note).toBe("Regalo per Marco");
  });

  it("permette di impostare una nota su una transazione auto (unico campo libero anche per auto)", async () => {
    const [transaction] = await db
      .insert(transactions)
      .values({
        userId,
        accountId,
        categoryId,
        description: "Movimento sincronizzato",
        amount: "-50.00",
        date: "2026-02-10",
        source: "auto",
        externalId: "ext-note-auto",
      })
      .returning();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/transactions/${transaction.id}`, {
        method: "PATCH",
        body: JSON.stringify({ note: "Da controllare" }),
      }),
      { params: Promise.resolve({ id: transaction.id }) }
    );

    expect(response.status).toBe(200);
    const updated = await response.json();
    expect(updated.note).toBe("Da controllare");
  });

  it("cancella una nota esistente inviando null", async () => {
    const [transaction] = await db
      .insert(transactions)
      .values({
        userId,
        accountId,
        categoryId,
        description: "Spesa",
        note: "Nota precedente",
        amount: "-50.00",
        date: "2026-02-10",
        source: "manuale",
      })
      .returning();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/transactions/${transaction.id}`, {
        method: "PATCH",
        body: JSON.stringify({ note: null }),
      }),
      { params: Promise.resolve({ id: transaction.id }) }
    );

    expect(response.status).toBe(200);
    const updated = await response.json();
    expect(updated.note).toBeNull();
  });

  it("risponde 400 se excludedAmount supera l'importo", async () => {
    const [transaction] = await db
      .insert(transactions)
      .values({
        userId,
        accountId,
        categoryId,
        description: "Spesa",
        amount: "-50.00",
        date: "2026-02-10",
        source: "manuale",
      })
      .returning();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/transactions/${transaction.id}`, {
        method: "PATCH",
        body: JSON.stringify({ excludedAmount: 60 }),
      }),
      { params: Promise.resolve({ id: transaction.id }) }
    );

    expect(response.status).toBe(400);
  });

  it("risponde 400 se modificare solo amount rende invalido l'excludedAmount già salvato", async () => {
    const [transaction] = await db
      .insert(transactions)
      .values({
        userId,
        accountId,
        categoryId,
        description: "Spesa con quota esclusa",
        amount: "-100.00",
        excludedAmount: "-30.00",
        date: "2026-02-10",
        source: "manuale",
      })
      .returning();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/transactions/${transaction.id}`, {
        method: "PATCH",
        body: JSON.stringify({ amount: 20 }),
      }),
      { params: Promise.resolve({ id: transaction.id }) }
    );

    expect(response.status).toBe(400);
  });

  it("permette di modificare amount se resta compatibile con l'excludedAmount già salvato", async () => {
    const [transaction] = await db
      .insert(transactions)
      .values({
        userId,
        accountId,
        categoryId,
        description: "Spesa con quota esclusa",
        amount: "-100.00",
        excludedAmount: "-30.00",
        date: "2026-02-10",
        source: "manuale",
      })
      .returning();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/transactions/${transaction.id}`, {
        method: "PATCH",
        body: JSON.stringify({ amount: 50 }),
      }),
      { params: Promise.resolve({ id: transaction.id }) }
    );

    expect(response.status).toBe(200);
    const updated = await response.json();
    expect(updated.amount).toBe("-50.00");
    expect(updated.excludedAmount).toBe("-30.00");
  });

  it("risponde 400 se categoryId appartiene a un altro utente", async () => {
    const [transaction] = await db
      .insert(transactions)
      .values({
        userId,
        accountId,
        categoryId,
        description: "Spesa",
        amount: "-50.00",
        date: "2026-02-10",
        source: "manuale",
      })
      .returning();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/transactions/${transaction.id}`, {
        method: "PATCH",
        body: JSON.stringify({ categoryId: otherUserCategoryId }),
      }),
      { params: Promise.resolve({ id: transaction.id }) }
    );

    expect(response.status).toBe(400);
  });

  it("risponde 404 su una transazione di un altro utente", async () => {
    const [otherTransaction] = await db
      .insert(transactions)
      .values({
        userId: otherUserId,
        accountId,
        categoryId,
        description: "Altrui",
        amount: "-10.00",
        date: "2026-02-10",
        source: "manuale",
      })
      .returning();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/transactions/${otherTransaction.id}`, {
        method: "PATCH",
        body: JSON.stringify({ description: "Tentativo" }),
      }),
      { params: Promise.resolve({ id: otherTransaction.id }) }
    );

    expect(response.status).toBe(404);
  });

  it("elimina una transazione manuale", async () => {
    const [transaction] = await db
      .insert(transactions)
      .values({
        userId,
        accountId,
        categoryId,
        description: "Da eliminare",
        amount: "-10.00",
        date: "2026-02-10",
        source: "manuale",
      })
      .returning();

    const response = await DELETE(
      new NextRequest(`http://localhost/api/transactions/${transaction.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: transaction.id }) }
    );

    expect(response.status).toBe(204);
  });

  it("risponde 400 se si tenta di eliminare una transazione auto", async () => {
    const [transaction] = await db
      .insert(transactions)
      .values({
        userId,
        accountId,
        categoryId,
        description: "Movimento sincronizzato",
        amount: "-10.00",
        date: "2026-02-10",
        source: "auto",
        externalId: "ext-3",
      })
      .returning();

    const response = await DELETE(
      new NextRequest(`http://localhost/api/transactions/${transaction.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: transaction.id }) }
    );

    expect(response.status).toBe(400);
  });
});
