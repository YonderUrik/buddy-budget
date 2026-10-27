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
import { transactionPageSchema } from "@/lib/views";
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

  it("moves the manual account's balance by each transaction typed by hand (expense down, income up)", async () => {
    await db.update(accounts).set({ balance: "100.00" }).where(eq(accounts.id, manualAccountId));
    const [income] = await db.insert(categories).values({ userId, name: "Stipendio", type: "entrata" }).returning();
    const post = (body: object) =>
      POST(new NextRequest("http://localhost/api/transactions", { method: "POST", body: JSON.stringify({ accountId: manualAccountId, date: "2026-02-10", ...body }) }));

    expect((await post({ description: "Spesa", categoryId, amount: 42.5 })).status).toBe(201);
    const [afterExpense] = await db.select().from(accounts).where(eq(accounts.id, manualAccountId));
    expect(afterExpense.balance).toBe("57.50");

    expect((await post({ description: "Stipendio", categoryId: income.id, amount: 1000 })).status).toBe(201);
    const [afterIncome] = await db.select().from(accounts).where(eq(accounts.id, manualAccountId));
    expect(afterIncome.balance).toBe("1057.50");
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

  it("GET aggiunge il logo dell'esercente quando il server lo trova, null per i bonifici", async () => {
    await db.insert(transactions).values([
      { userId, accountId: manualAccountId, categoryId, description: "Netflix", amount: "-12.99", date: "2026-03-05", source: "manuale" },
      { userId, accountId: manualAccountId, categoryId, description: "Bonifico a Mario", amount: "-50.00", date: "2026-03-06", source: "manuale" },
    ]);

    const response = await GET(new NextRequest("http://localhost/api/transactions?from=2026-03-01&to=2026-03-31&type=uscita"));
    const list: { description: string; logoPath: string | null }[] = await response.json();
    expect(list.find((t) => t.description === "Netflix")?.logoPath).toBe("/api/merchant-logos/netflix.com");
    expect(list.find((t) => t.description === "Bonifico a Mario")?.logoPath).toBeNull();
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

  describe("paged mode (native apps)", () => {
    async function seedFeed() {
      const [incomeCategory] = await db.insert(categories).values({ userId, name: "Stipendio", type: "entrata" }).returning();
      const [fallback] = await db.insert(categories).values({ userId, name: "Da categorizzare", type: "voluta", isFallback: true }).returning();
      await db.insert(transactions).values([
        { userId, accountId: manualAccountId, categoryId, description: "Supermercato", amount: "-20.00", date: "2026-02-05", source: "manuale" },
        { userId, accountId: manualAccountId, categoryId, description: "Bar", note: "caffè al supermercato", amount: "-2.00", date: "2026-02-05", source: "manuale" },
        { userId, accountId: autoAccountId, categoryId: incomeCategory.id, description: "Stipendio", amount: "1800.00", date: "2026-02-27", source: "auto" },
        { userId, accountId: autoAccountId, categoryId: fallback.id, description: "???", amount: "-9.00", date: "2026-03-01", source: "auto" },
        { userId: otherUserId, accountId: otherAccountId, categoryId: otherCategoryId, description: "Supermercato", amount: "-5.00", date: "2026-02-06", source: "manuale" },
      ]);
    }
    const page = async (query: string) => {
      const response = await GET(new NextRequest(`http://localhost/api/transactions?${query}`));
      return { status: response.status, body: await response.json() };
    };

    it("walks the whole feed with the cursor, every type by default, newest first", async () => {
      await seedFeed();
      const first = await page("limit=3");
      expect(first.status).toBe(200);
      expect(transactionPageSchema.parse(first.body).items.map((t) => t.date)).toEqual(["2026-03-01", "2026-02-27", "2026-02-05"]);
      expect(first.body.nextCursor).toEqual(expect.any(String));
      const second = await page(`limit=3&cursor=${first.body.nextCursor}`);
      expect(second.body.items.map((t: { description: string }) => t.description)).toHaveLength(1);
      expect(second.body.nextCursor).toBeNull();
      const ids = [...first.body.items, ...second.body.items].map((t: { id: string }) => t.id);
      expect(new Set(ids).size).toBe(4);
    });

    it("filters like the Movimenti screen", async () => {
      await seedFeed();
      const descriptions = async (query: string) => (await page(`limit=50&${query}`)).body.items.map((t: { description: string }) => t.description);
      // Same day: the order inside it follows the (random) ids, so compare as a set.
      expect((await descriptions("q=supermercato")).sort()).toEqual(["Bar", "Supermercato"]);
      expect(await descriptions("type=entrata")).toEqual(["Stipendio"]);
      expect(await descriptions(`accountId=${autoAccountId}&type=uscita`)).toEqual(["???"]);
      expect(await descriptions(`categoryId=${categoryId}&from=2026-02-01&to=2026-02-28`)).toHaveLength(2);
      expect(await descriptions("uncategorized=1")).toEqual(["???"]);
    });

    it("rejects a bad limit or cursor with stable codes", async () => {
      expect((await page("limit=0")).body).toMatchObject({ code: "validation_failed", field: "limit" });
      expect((await page("limit=201")).status).toBe(400);
      expect((await page("cursor=abc")).body).toMatchObject({ code: "invalid_cursor" });
    });

    it("keeps the legacy array when no limit or cursor is given", async () => {
      await seedFeed();
      const legacy = await page("from=2026-01-01&to=2026-12-31&type=tutte");
      expect(Array.isArray(legacy.body)).toBe(true);
      expect(legacy.body).toHaveLength(4);
    });
  });
});
