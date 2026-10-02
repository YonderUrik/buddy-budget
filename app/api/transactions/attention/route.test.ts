import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
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
import { POST } from "./seen/route";

const mockedGetSession = vi.mocked(auth.api.getSession);

function request(path: string, method = "GET") {
  return new NextRequest(`http://localhost${path}`, { method });
}

describe("GET /api/transactions/attention e POST …/seen", () => {
  let userId: string;
  let accountId: string;
  let fallbackId: string;
  let foodId: string;

  beforeEach(async () => {
    const [user] = await db
      .insert(authUser)
      .values({
        id: `test-attention-${crypto.randomUUID()}`,
        name: "Test",
        email: `test-attention-${crypto.randomUUID()}@example.com`,
        movementsSeenAt: new Date("2026-01-01T00:00:00Z"),
      })
      .returning();
    userId = user.id;
    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);
    const [account] = await db.insert(accounts).values({ userId, name: "Conto", type: "Conto corrente", balance: "0.00" }).returning();
    accountId = account.id;
    const [fallback] = await db
      .insert(categories)
      .values({ userId, name: "Da categorizzare", type: "voluta", icon: "help-circle", color: "red", isFallback: true })
      .returning();
    fallbackId = fallback.id;
    const [food] = await db.insert(categories).values({ userId, name: "Spesa", type: "dovuta", icon: "cart", color: "green" }).returning();
    foodId = food.id;
  });

  afterAll(async () => {
    await client.end();
  });

  async function add(values: { categoryId: string; source: "auto" | "manuale"; createdAt: Date }) {
    await db.insert(transactions).values({
      userId,
      accountId,
      categoryId: values.categoryId,
      description: "Test",
      amount: "-10.00",
      date: "2026-02-01",
      source: values.source,
      createdAt: values.createdAt,
    });
  }

  it("risponde 401 senza sessione", async () => {
    mockedGetSession.mockResolvedValue(null);
    expect((await GET(request("/api/transactions/attention"))).status).toBe(401);
    expect((await POST(request("/api/transactions/attention/seen", "POST"))).status).toBe(401);
  });

  it("conta nuove, da categorizzare e distinte", async () => {
    const after = new Date("2026-03-01T00:00:00Z");
    const before = new Date("2025-12-01T00:00:00Z");
    await add({ categoryId: fallbackId, source: "auto", createdAt: after }); // nuova e da categorizzare
    await add({ categoryId: foodId, source: "auto", createdAt: after }); // solo nuova
    await add({ categoryId: fallbackId, source: "auto", createdAt: before }); // solo da categorizzare
    await add({ categoryId: foodId, source: "manuale", createdAt: after }); // manuale: mai nuova
    await add({ categoryId: foodId, source: "auto", createdAt: before }); // né l'una né l'altra

    const body = await (await GET(request("/api/transactions/attention"))).json();
    expect(body).toMatchObject({ newCount: 2, uncategorizedCount: 2, totalCount: 3 });
    expect(body.newTransactionIds).toHaveLength(2);
  });

  it("dopo 'seen' le transazioni non sono più nuove ma restano da categorizzare", async () => {
    await add({ categoryId: fallbackId, source: "auto", createdAt: new Date("2026-03-01T00:00:00Z") });
    expect((await POST(request("/api/transactions/attention/seen", "POST"))).status).toBe(204);
    const body = await (await GET(request("/api/transactions/attention"))).json();
    expect(body).toMatchObject({ newCount: 0, uncategorizedCount: 1, totalCount: 1, newTransactionIds: [] });
    const [user] = await db.select().from(authUser).where(eq(authUser.id, userId));
    expect(user.movementsSeenAt.getTime()).toBeGreaterThan(Date.now() - 60_000);
  });

  it("non conta le transazioni di un altro utente", async () => {
    await add({ categoryId: fallbackId, source: "auto", createdAt: new Date("2026-03-01T00:00:00Z") });
    mockedGetSession.mockResolvedValue({ user: { id: "altro-utente" } } as never);
    const body = await (await GET(request("/api/transactions/attention"))).json();
    expect(body).toMatchObject({ newCount: 0, uncategorizedCount: 0, totalCount: 0 });
  });
});
