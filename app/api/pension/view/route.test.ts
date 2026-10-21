import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { pensionFunds, pensionSnapshots } from "@/lib/db/schema/pension";
import { exitTaxRate, withdrawalScenarios } from "@/lib/calc/pension";
import { pensionViewSchema } from "@/lib/views";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

import { auth } from "@/lib/auth";
import { GET } from "./route";

const mockedGetSession = vi.mocked(auth.api.getSession);
const get = (query = "") => GET(new NextRequest(`http://localhost/api/pension/view${query}`));

describe("GET /api/pension/view", () => {
  let userId: string;
  let fundId: string;

  beforeEach(async () => {
    userId = `test-pension-view-${crypto.randomUUID()}`;
    await db.insert(authUser).values({ id: userId, name: "T", email: `${userId}@example.com`, emailVerified: true, currency: "EUR", productCountry: "IT" });
    mockedGetSession.mockResolvedValue({ user: { id: userId, currency: "EUR", productCountry: "IT" } } as never);
    const [fund] = await db.insert(pensionFunds).values({ userId, name: "Fondo", adhesionDate: "2010-03-01" }).returning();
    fundId = fund.id;
    await db.insert(pensionSnapshots).values([
      { fundId, userId, date: "2025-01-01", netContributions: "10000.00", value: "11000.00" },
      { fundId, userId, date: "2025-10-01", netContributions: "11500.00", value: "12800.00" },
      { fundId, userId, date: "2026-10-01", netContributions: "13500.00", value: "15200.00" },
    ]);
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("computes the first fund's view and the exit-tax timeline", async () => {
    const response = await get("?today=2026-10-18");
    expect(response.status).toBe(200);
    const view = pensionViewSchema.parse(await response.json());
    expect(view.fund?.id).toBe(fundId);
    expect(view.last).toMatchObject({ value: 15200, netContributions: 13500 });
    expect(view.performance).toMatchObject({ value: 15200, gain: 1700 });
    expect(view.quarterly).toBeCloseTo(500, 0);
    expect(view.exitTax).toMatchObject({ realYears: 16, rate: exitTaxRate(16), maxYears: 35 });
    expect(view.exitTax.timeline).toHaveLength(36);
    expect(view.exitTax.timeline[30]?.scenarios).toEqual(withdrawalScenarios(15200, 13500, "2010-03-01", "2026-10-18", 30));
    expect(view.scenarios).toEqual(view.exitTax.timeline[16]?.scenarios);
    expect(view.projection.sliders.quarterlyContribution.default).toBe(500);
    expect(view.projection.preview?.year).toBe(25);
    expect(view.yearly.map((y) => y.year)).toEqual([2025, 2026]);
  });

  it("selects a fund by id; unknown ids are 404, malformed ones 400", async () => {
    expect(pensionViewSchema.parse(await (await get(`?fundId=${fundId}&today=2026-10-18`)).json()).fund?.id).toBe(fundId);
    const missing = await get(`?fundId=${crypto.randomUUID()}`);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ code: "pension_fund_not_found" });
    expect(await (await get("?fundId=x")).json()).toMatchObject({ code: "validation_failed", field: "fundId" });
    expect(await (await get("?today=oggi")).json()).toMatchObject({ code: "invalid_date" });
  });

  it("is Italy only", async () => {
    mockedGetSession.mockResolvedValue({ user: { id: userId, productCountry: "DE" } } as never);
    const response = await get();
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "country_feature_unavailable" });
  });

  it("without funds the view is empty", async () => {
    await db.delete(pensionFunds).where(eq(pensionFunds.userId, userId));
    expect(pensionViewSchema.parse(await (await get("?today=2026-10-18")).json())).toMatchObject({ fund: null, last: null, scenarios: [], tfr: null });
  });
});
