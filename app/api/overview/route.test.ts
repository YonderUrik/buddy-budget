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
import { liquidityMonthSchema, overviewViewSchema } from "@/lib/views";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

import { auth } from "@/lib/auth";
import { GET as getOverview } from "./route";
import { GET as getMonth } from "../liquidity/month/route";

const mockedGetSession = vi.mocked(auth.api.getSession);

describe("view endpoints: GET /api/overview and GET /api/liquidity/month", () => {
  let userId: string;
  let accountId: string;

  beforeEach(async () => {
    userId = `test-views-${crypto.randomUUID()}`;
    await db.insert(authUser).values({ id: userId, name: "Test", email: `${userId}@example.com`, emailVerified: true, currency: "EUR", language: "en", productCountry: "IT" });
    mockedGetSession.mockResolvedValue({ user: { id: userId, currency: "EUR", language: "en", productCountry: "IT" } } as never);
    const cats = await db.insert(categories).values(defaultCategoryRows(userId)).returning();
    const groceries = cats.find((c) => c.defaultKey === "spesa")!;
    const [account] = await db.insert(accounts).values({ userId, name: "Conto", type: "Conto corrente", balance: "1500.00" }).returning();
    accountId = account.id;
    await db.insert(budgets).values({ userId, categoryId: groceries.id, monthlyAmount: "300.00" });
    await db.insert(transactions).values([
      { userId, accountId, categoryId: groceries.id, description: "Supermercato", amount: "-120.00", date: "2026-10-03", source: "manuale" },
      { userId, accountId, categoryId: groceries.id, description: "Supermercato", amount: "-80.00", date: "2026-09-04", source: "manuale" },
    ]);
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("require a session", async () => {
    mockedGetSession.mockResolvedValueOnce(null as never);
    expect((await getOverview(new NextRequest("http://localhost/api/overview"))).status).toBe(401);
    mockedGetSession.mockResolvedValueOnce(null as never);
    expect((await getMonth(new NextRequest("http://localhost/api/liquidity/month"))).status).toBe(401);
  });

  it("overview: computed for the session user on the client's day, in the user's language", async () => {
    const response = await getOverview(new NextRequest("http://localhost/api/overview?period=1mese&today=2026-10-18"));
    expect(response.status).toBe(200);
    const view = overviewViewSchema.parse(await response.json());
    expect(view).toMatchObject({ today: "2026-10-18", period: "1mese", isEmpty: false, todayByClass: { liquidita: 1500 } });
    expect(view.monthPace).toMatchObject({ spentSoFar: 120, typicalSoFar: 80, budgetTotal: 300, budgetSpent: 120 });
    expect(view.composition[0]).toMatchObject({ key: "liquidita", label: "Cash", detail: "1 account" });
    expect(view.monthLabel).toBe("October");
  });

  it("overview: rejects unknown periods and malformed days with stable codes", async () => {
    expect(await (await getOverview(new NextRequest("http://localhost/api/overview?period=ytd"))).json()).toMatchObject({ code: "invalid_period" });
    expect(await (await getOverview(new NextRequest("http://localhost/api/overview?today=18-10-2026"))).json()).toMatchObject({ code: "invalid_date" });
  });

  it("liquidity month: figures, budget progress and localized names", async () => {
    const response = await getMonth(new NextRequest(`http://localhost/api/liquidity/month?today=2026-10-18&accountId=${accountId}`));
    expect(response.status).toBe(200);
    const month = liquidityMonthSchema.parse(await response.json());
    expect(month).toMatchObject({ accountId, spent: 120, income: 0, budget: { total: 300, spent: 120, remaining: 180 } });
    expect(month.budgets).toEqual([expect.objectContaining({ name: "Groceries", budget: 300, spent: 120, progress: 0.4 })]);
    expect(month.groups.map((g) => g.label)).toEqual(["Needs", "Wants", "Future you", "Occasional"]);
  });

  it("liquidity month: rejects a malformed account id", async () => {
    const response = await getMonth(new NextRequest("http://localhost/api/liquidity/month?accountId=abc"));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "validation_failed", field: "accountId" });
  });
});
