import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { client, db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { authUser } from "@/lib/db/schema/auth";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";
import { defaultCategoryRows } from "@/lib/categories/seed";
import { analyticsViewSchema } from "@/lib/views";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

import { auth } from "@/lib/auth";
import { GET } from "./route";
import { GET as getPlan } from "../../financial-planning/route";
import { isCountryPathAvailable } from "@/lib/localization/config";

const mockedGetSession = vi.mocked(auth.api.getSession);
const session = (productCountry: "IT" | "DE") => ({ user: { id: userId, currency: "EUR", language: "it", productCountry } }) as never;
let userId: string;

describe("GET /api/analytics/base", () => {
  beforeEach(async () => {
    userId = `test-analytics-base-${crypto.randomUUID()}`;
    await db.insert(authUser).values({ id: userId, name: "T", email: `${userId}@example.com`, emailVerified: true, currency: "EUR", productCountry: "IT" });
    mockedGetSession.mockResolvedValue(session("IT"));
    const cats = await db.insert(categories).values(defaultCategoryRows(userId)).returning();
    const groceries = cats.find((c) => c.defaultKey === "spesa")!;
    const salary = cats.find((c) => c.type === "entrata")!;
    const [account] = await db.insert(accounts).values({ userId, name: "Conto", type: "Conto corrente", balance: "20000.00" }).returning();
    const rows = [];
    for (let m = 0; m < 12; m++) {
      const month = String(m + 1).padStart(2, "0");
      rows.push(
        { userId, accountId: account.id, categoryId: salary.id, description: "Stipendio", amount: "2500.00", date: `2025-${month}-27`, source: "manuale" as const },
        { userId, accountId: account.id, categoryId: groceries.id, description: "Spesa", amount: "-1500.00", date: `2025-${month}-10`, source: "manuale" as const },
      );
    }
    await db.insert(transactions).values(rows);
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("computes base, assumptions, plan and the saved plan's readings in one call", async () => {
    const response = await GET(new NextRequest("http://localhost/api/analytics/base?today=2026-01-15"));
    expect(response.status).toBe(200);
    const view = analyticsViewSchema.parse(await response.json());
    expect(view.base.wealth.liquidity).toBe(20000);
    expect(view.base.cashflow).toMatchObject({ annualIncome: 30000, annualSpending: 18000, annualSavings: 12000 });
    expect(view.plan).toMatchObject({ spending: 18000, savings: 12000, wealth: 20000 });
    expect(view.plan.target).toBeGreaterThan(0);
    expect(view.timeline.series[0]).toEqual({ year: 0, wealth: 20000 });
    expect(view.walkthroughSeen).toBe(false);
  });

  it("rejects a malformed day", async () => {
    expect(await (await GET(new NextRequest("http://localhost/api/analytics/base?today=x"))).json()).toMatchObject({ code: "invalid_date" });
  });

  it("is open in every country; /api/financial-planning answers Italy with a coded 403", async () => {
    // Since #465 Analitiche runs everywhere; the Italian tax view is Italy only and Germany keeps its own income.
    expect(["IT", "DE", "OTHER"].map((c) => isCountryPathAvailable(c, "/api/analytics/base"))).toEqual([true, true, true]);
    expect(["IT", "DE", "OTHER"].map((c) => isCountryPathAvailable(c, "/api/investments/taxes"))).toEqual([true, false, false]);
    expect(["IT", "DE", "OTHER"].map((c) => isCountryPathAvailable(c, "/api/investments/income"))).toEqual([true, false, true]);
    mockedGetSession.mockResolvedValue(session("IT"));
    const it = await getPlan(new NextRequest("http://localhost/api/financial-planning"));
    expect(it.status).toBe(403);
    expect(await it.json()).toMatchObject({ code: "country_feature_unavailable" });
  });
});
