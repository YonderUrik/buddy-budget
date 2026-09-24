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
import { GET, POST } from "./route";

const mockedGetSession = vi.mocked(auth.api.getSession);

describe("GET/POST /api/transactions", () => {
  let userId: string;
  let manualAccountId: string;
  let autoAccountId: string;
  let categoryId: string;
  let otherUserId: string;
  let otherAccountId: string;
  let otherCategoryId: string;

  beforeEach(async () => {
    const testId = `test-transactions-${crypto.randomUUID()}`;
    const [user] = await db
      .insert(authUser)
      .values({
        id: testId,
        name: "Test User",
        email: `test-transactions-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    userId = user.id;
    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);

    const [manualAccount] = await db
      .insert(accounts)
      .values({ userId, name: "Contanti", type: "Contanti", balance: "0.00" })
      .returning();
    manualAccountId = manualAccount.id;

    const [autoAccount] = await db
      .insert(accounts)
      .values({ userId, name: "Conto Auto", type: "Conto corrente", balance: "0.00", source: "auto" })
      .returning();
    autoAccountId = autoAccount.id;

    const [category] = await db
      .insert(categories)
      .values({ userId, name: "Spesa alimentare", type: "voluta" })
      .returning();
    categoryId = category.id;

    const otherTestId = `test-transactions-other-${crypto.randomUUID()}`;
    const [otherUser] = await db
      .insert(authUser)
      .values({
        id: otherTestId,
        name: "Other Test User",
        email: `test-transactions-other-${Date.now()}@example.com`,
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
      .values({ userId: otherUserId, name: "Spesa altro utente", type: "voluta" })
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
    const response = await GET(new NextRequest("http://localhost/api/transactions?from=2026-01-01&to=2026-12-31"));
    expect(response.status).toBe(401);
  });

  it("risponde 400 senza from/to", async () => {
    const response = await GET(new NextRequest("http://localhost/api/transactions"));
    expect(response.status).toBe(400);
  });

  it("crea una spesa manuale con importo negato e la ritorna nella lista, escludendo le entrate", async () => {
    await db.insert(transactions).values({
      userId,
      accountId: manualAccountId,
      categoryId,
      description: "Stipendio",
      amount: "2000.00",
      date: "2026-02-01",
      source: "manuale",
    });

    const postResponse = await POST(
      new NextRequest("http://localhost/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          accountId: manualAccountId,
          description: "Spesa al supermercato",
          categoryId,
          amount: 42.5,
          date: "2026-02-10",
        }),
      })
    );
    expect(postResponse.status).toBe(201);
    const created = await postResponse.json();
    expect(created.amount).toBe("-42.50");

    const getResponse = await GET(
      new NextRequest("http://localhost/api/transactions?from=2026-01-01&to=2026-12-31")
    );
    const list = await getResponse.json();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(created.id);
  });

  it("crea un'entrata con importo positivo quando la categoria è di tipo entrata", async () => {
    const [incomeCategory] = await db
      .insert(categories)
      .values({ userId, name: "Stipendio", type: "entrata" })
      .returning();

    const response = await POST(
      new NextRequest("http://localhost/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          accountId: manualAccountId,
          description: "Stipendio di febbraio",
          categoryId: incomeCategory.id,
          amount: 1800,
          date: "2026-02-27",
        }),
      })
    );
    expect(response.status).toBe(201);
    const created = await response.json();
    expect(created.amount).toBe("1800.00");
  });

  it("GET con type=entrata ritorna solo le entrate", async () => {
    const [incomeCategory] = await db
      .insert(categories)
      .values({ userId, name: "Stipendio", type: "entrata" })
      .returning();
    await db.insert(transactions).values([
      { userId, accountId: manualAccountId, categoryId, description: "Spesa", amount: "-20.00", date: "2026-02-05", source: "manuale" },
      { userId, accountId: manualAccountId, categoryId: incomeCategory.id, description: "Stipendio", amount: "1800.00", date: "2026-02-27", source: "manuale" },
    ]);

    const response = await GET(
      new NextRequest("http://localhost/api/transactions?from=2026-01-01&to=2026-12-31&type=entrata")
    );
    const list = await response.json();
    expect(list).toHaveLength(1);
    expect(list[0].description).toBe("Stipendio");
  });

  it("GET con type=tutte ritorna sia entrate che uscite", async () => {
    const [incomeCategory] = await db
      .insert(categories)
      .values({ userId, name: "Stipendio", type: "entrata" })
      .returning();
    await db.insert(transactions).values([
      { userId, accountId: manualAccountId, categoryId, description: "Spesa", amount: "-20.00", date: "2026-02-05", source: "manuale" },
      { userId, accountId: manualAccountId, categoryId: incomeCategory.id, description: "Stipendio", amount: "1800.00", date: "2026-02-27", source: "manuale" },
    ]);

    const response = await GET(
      new NextRequest("http://localhost/api/transactions?from=2026-01-01&to=2026-12-31&type=tutte")
    );
    const list = await response.json();
    expect(list).toHaveLength(2);
  });

  it("risponde 400 se type non è uno dei valori validi", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/transactions?from=2026-01-01&to=2026-12-31&type=boh")
    );
    expect(response.status).toBe(400);
  });

  it("risponde 400 se il conto è auto", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          accountId: autoAccountId,
          description: "Spesa",
          categoryId,
          amount: 10,
          date: "2026-02-10",
        }),
      })
    );
    expect(response.status).toBe(400);
  });

  it("risponde 400 se accountId appartiene a un altro utente", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          accountId: otherAccountId,
          description: "Spesa",
          categoryId,
          amount: 10,
          date: "2026-02-10",
        }),
      })
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Conto non valido");
  });

  it("risponde 400 se categoryId appartiene a un altro utente", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          accountId: manualAccountId,
          description: "Spesa",
          categoryId: otherCategoryId,
          amount: 10,
          date: "2026-02-10",
        }),
      })
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Categoria non valida");
  });

  it("risponde 400 se from o to hanno formato non valido", async () => {
    const response = await GET(new NextRequest("http://localhost/api/transactions?from=abc&to=2026-12-31"));
    expect(response.status).toBe(400);
  });
});
