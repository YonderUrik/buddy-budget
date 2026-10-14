import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { categories } from "@/lib/db/schema/categories";
import { categorizationRules } from "@/lib/db/schema/categorization-rules";
import { accounts } from "@/lib/db/schema/accounts";
import { transactions } from "@/lib/db/schema/transactions";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { GET, POST } from "./route";

const mockedGetSession = vi.mocked(auth.api.getSession);

describe("GET/POST /api/categorization-rules", () => {
  let userId: string;
  let otherUserId: string;
  let categoryId: string;
  let otherCategoryId: string;
  let fallbackCategoryId: string;

  beforeEach(async () => {
    const testId = `test-rules-${crypto.randomUUID()}`;
    const [user] = await db
      .insert(authUser)
      .values({
        id: testId,
        name: "Test User",
        email: `test-rules-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    userId = user.id;

    const otherId = `test-rules-other-${crypto.randomUUID()}`;
    const [otherUser] = await db
      .insert(authUser)
      .values({
        id: otherId,
        name: "Other User",
        email: `test-rules-other-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    otherUserId = otherUser.id;

    const [category] = await db
      .insert(categories)
      .values({ userId, name: "Spesa alimentare", type: "voluta" })
      .returning();
    categoryId = category.id;

    const [otherCategory] = await db
      .insert(categories)
      .values({ userId: otherUserId, name: "Categoria altrui", type: "voluta" })
      .returning();
    otherCategoryId = otherCategory.id;

    const [fallbackCategory] = await db
      .insert(categories)
      .values({ userId, name: "Da categorizzare", type: "voluta", isFallback: true })
      .returning();
    fallbackCategoryId = fallbackCategory.id;

    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
    await db.delete(authUser).where(eq(authUser.id, otherUserId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("risponde 401 senza sessione", async () => {
    mockedGetSession.mockResolvedValueOnce(null);

    const response = await GET(new NextRequest("http://localhost/api/categorization-rules"));

    expect(response.status).toBe(401);
  });

  it("elenca solo le regole dell'utente autenticato", async () => {
    await db.insert(categorizationRules).values({
      userId,
      matchType: "merchant",
      pattern: "esselunga",
      categoryId,
      hitCount: 3,
    });
    await db.insert(categorizationRules).values({
      userId: otherUserId,
      matchType: "merchant",
      pattern: "conad",
      categoryId: otherCategoryId,
      hitCount: 9,
    });

    const response = await GET(new NextRequest("http://localhost/api/categorization-rules"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0].pattern).toBe("esselunga");
    expect(body[0].categoryName).toBe("Spesa alimentare");
  });

  it("crea una regola normalizzando il pattern con merchantKey", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/categorization-rules", {
        method: "POST",
        body: JSON.stringify({ matchType: "merchant", pattern: "ESSELUNGA SPA", categoryId }),
      })
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.pattern).toBe("esselunga");
    expect(body.source).toBe("manuale");
  });

  it("rifiuta con 404 una categoria di un altro utente", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/categorization-rules", {
        method: "POST",
        body: JSON.stringify({ matchType: "merchant", pattern: "esselunga", categoryId: otherCategoryId }),
      })
    );

    expect(response.status).toBe(404);
  });

  it("rifiuta con 400 una regola sulla categoria di fallback", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/categorization-rules", {
        method: "POST",
        body: JSON.stringify({ matchType: "merchant", pattern: "esselunga", categoryId: fallbackCategoryId }),
      })
    );

    expect(response.status).toBe(400);
  });

  it("rifiuta con 409 una regola duplicata su stesso tipo e pattern", async () => {
    await db.insert(categorizationRules).values({
      userId,
      matchType: "merchant",
      pattern: "esselunga",
      categoryId,
    });

    const response = await POST(
      new NextRequest("http://localhost/api/categorization-rules", {
        method: "POST",
        body: JSON.stringify({ matchType: "merchant", pattern: "ESSELUNGA", categoryId }),
      })
    );

    expect(response.status).toBe(409);
  });

  it("con replaceExisting dà la categoria nuova alla regola che c'è già", async () => {
    const [second] = await db.insert(categories).values({ userId, name: "Casa", type: "dovuta" }).returning();
    const [existing] = await db
      .insert(categorizationRules)
      .values({ userId, matchType: "merchant", pattern: "esselunga", categoryId })
      .returning();

    const response = await POST(
      new NextRequest("http://localhost/api/categorization-rules", {
        method: "POST",
        body: JSON.stringify({ matchType: "merchant", pattern: "ESSELUNGA", categoryId: second.id, replaceExisting: true }),
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe(existing.id);
    expect(body.categoryId).toBe(second.id);
    const rules = await db.select().from(categorizationRules).where(eq(categorizationRules.userId, userId));
    expect(rules).toHaveLength(1);
  });

  it("applica subito la regola ai movimenti ancora da categorizzare", async () => {
    const [account] = await db.insert(accounts).values({ userId, name: "Conto", type: "Conto corrente", balance: "0" }).returning();
    const [pending] = await db
      .insert(transactions)
      .values({ userId, accountId: account.id, categoryId: fallbackCategoryId, description: "Esselunga", amount: "-20.00", date: "2026-10-01" })
      .returning();
    // Già messo da solo in un'altra categoria: non cambia da sé, ma la risposta lo conta per «Cambiali».
    const [svago] = await db.insert(categories).values({ userId, name: "Svago", type: "voluta" }).returning();
    await db.insert(transactions).values({
      userId,
      accountId: account.id,
      categoryId: svago.id,
      description: "Esselunga",
      amount: "-12.00",
      date: "2026-09-01",
      categorySource: "storico",
      categorizedAt: new Date(),
    });

    const response = await POST(
      new NextRequest("http://localhost/api/categorization-rules", {
        method: "POST",
        body: JSON.stringify({ matchType: "merchant", pattern: "Esselunga", categoryId }),
      })
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.applied).toBe(1);
    expect(body.pastMatches).toBe(1);
    const [row] = await db.select().from(transactions).where(eq(transactions.id, pending.id));
    expect(row.categoryId).toBe(categoryId);
    expect(row.categorySource).toBe("regola");
  });
});
