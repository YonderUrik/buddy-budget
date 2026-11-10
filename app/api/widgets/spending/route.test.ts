import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { client, db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { authUser } from "@/lib/db/schema/auth";
import { budgets } from "@/lib/db/schema/budgets";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";
import { defaultCategoryRows } from "@/lib/categories/seed";
import { widgetSpendingSchema } from "@/lib/views";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

import { auth } from "@/lib/auth";
import { GET } from "./route";

const mockedGetSession = vi.mocked(auth.api.getSession);

describe("GET /api/widgets/spending", () => {
  let userId: string;
  let accountId: string;
  let groceriesId: string;
  let transferId: string;

  beforeEach(async () => {
    userId = `test-widgets-${crypto.randomUUID()}`;
    await db.insert(authUser).values({ id: userId, name: "Test", email: `${userId}@example.com`, emailVerified: true, currency: "EUR", language: "it", productCountry: "IT" });
    mockedGetSession.mockResolvedValue({ user: { id: userId, currency: "EUR", language: "it", productCountry: "IT", hideAmounts: true } } as never);
    const cats = await db.insert(categories).values(defaultCategoryRows(userId)).returning();
    groceriesId = cats.find((c) => c.defaultKey === "spesa")!.id;
    transferId = cats.find((c) => c.type === "trasferimento")!.id;
    const [account] = await db.insert(accounts).values({ userId, name: "Conto", type: "Conto corrente", balance: "1500.00" }).returning();
    accountId = account.id;
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("requires a session", async () => {
    mockedGetSession.mockResolvedValueOnce(null as never);
    expect((await GET(new NextRequest("http://localhost/api/widgets/spending"))).status).toBe(401);
  });

  it("rejects a malformed day with a stable code", async () => {
    const response = await GET(new NextRequest("http://localhost/api/widgets/spending?today=14-10-2026"));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "invalid_date", field: "today" });
  });

  it("serves the user's figures on the device day, private and never cached", async () => {
    await db.insert(budgets).values({ userId, categoryId: groceriesId, monthlyAmount: "300.00" });
    await db.insert(transactions).values([
      { userId, accountId, categoryId: groceriesId, description: "Esselunga", amount: "-18.00", date: "2026-10-14", source: "manuale", createdAt: new Date("2026-10-14T08:00:00Z") },
      { userId, accountId, categoryId: groceriesId, description: "Coop", amount: "-30.00", date: "2026-10-14", source: "manuale", createdAt: new Date("2026-10-14T09:00:00Z") },
      // A later transfer and a future movement are not «the last movement».
      { userId, accountId, categoryId: transferId, description: "Giroconto", amount: "-500.00", excludedAmount: "-500.00", date: "2026-10-14", source: "manuale", createdAt: new Date("2026-10-14T10:00:00Z") },
      { userId, accountId, categoryId: groceriesId, description: "Futuro", amount: "-5.00", date: "2026-10-20", source: "manuale" },
      { userId, accountId, categoryId: groceriesId, description: "Supermercato", amount: "-102.00", date: "2026-10-12", source: "manuale" },
      { userId, accountId, categoryId: groceriesId, description: "Supermercato", amount: "-80.00", date: "2026-09-04", source: "manuale" },
    ]);

    const response = await GET(new NextRequest("http://localhost/api/widgets/spending?today=2026-10-14"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const view = widgetSpendingSchema.parse(await response.json());
    expect(view).toMatchObject({
      currency: "EUR",
      hideAmounts: true,
      today: { date: "2026-10-14", spent: 48 },
      week: { from: "2026-10-12", spent: 150 },
      month: { key: "2026-10", label: "ottobre", spent: 150, typicalSoFar: 80, gap: 70, tone: "neg" },
      budget: { available: 300, spent: 155, left: 145, perDay: 8.06 },
      lastMovement: { date: "2026-10-14", amount: -30, merchant: "Coop" },
    });
  });

  it("without budgets or movements: nulls, not errors", async () => {
    const view = widgetSpendingSchema.parse(await (await GET(new NextRequest("http://localhost/api/widgets/spending?today=2026-10-14"))).json());
    expect(view).toMatchObject({ today: { spent: 0 }, month: { spent: 0, tone: null }, budget: null, lastMovement: null });
  });
});
