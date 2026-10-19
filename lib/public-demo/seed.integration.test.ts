import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { fxRates, instruments, investmentTaxCarryforwards, userPriceAlerts, userWatchlistItems } from "@/lib/db/schema/investments";
import { investmentBrokerGroups } from "@/lib/investments/broker-filter";
import { loadInvestmentData } from "@/lib/investments/data";
import { buildInvestmentsView } from "@/lib/investments/view";
import { seedDemoAccount } from "./seed";

const userIds: string[] = [];
/** The seed invents USD and CHF rates on a database without any: the test removes them again. */
let hadRates = true;

beforeAll(async () => {
  hadRates = (await db.select({ id: fxRates.id }).from(fxRates).where(inArray(fxRates.currency, ["USD", "CHF"])).limit(1)).length > 0;
});

afterAll(async () => {
  if (!hadRates) await db.delete(fxRates).where(inArray(fxRates.currency, ["USD", "CHF"]));
  // One user at a time, as the seed does: deleting a user leaves its invented securities without owner, and two
  // orphans with the same ISIN would clash.
  for (const userId of userIds) {
    const owned = await db.select({ id: instruments.id }).from(instruments).where(eq(instruments.createdByUserId, userId));
    await db.delete(authUser).where(eq(authUser.id, userId));
    if (owned.length) await db.delete(instruments).where(inArray(instruments.id, owned.map((row) => row.id)));
  }
  await client.end();
});

describe("demo account investments", () => {
  it.each([
    { language: "it", productCountry: "IT", broker: "interactive-brokers", carryforwards: 1 },
    { language: "de", productCountry: "DE", broker: "trade-republic", carryforwards: 0 },
  ] as const)("seeds a priced portfolio across two brokers ($productCountry)", async ({ language, productCountry, broker, carryforwards }) => {
    const userId = `seed-test-${productCountry.toLowerCase()}-${crypto.randomUUID()}`;
    userIds.push(userId);
    const now = new Date("2026-10-18T12:00:00Z");
    await seedDemoAccount({ userId, email: `${userId}@example.com`, language, productCountry, now });

    const data = await loadInvestmentData(userId, null);
    const view = buildInvestmentsView(data, "1anno", now);
    const open = view.summary.rows.filter((row) => row.quantity > 0);
    // Every open position has a price (FX included), so totals, history and analytics are complete.
    expect(view.summary.unpricedCount).toBe(0);
    expect(open).toHaveLength(13);
    expect(new Set(open.map((row) => row.instrument.currency))).toEqual(new Set(["EUR", "USD", "CHF"]));
    expect(investmentBrokerGroups(data).map((group) => group.id).sort()).toEqual([broker, "manual"].sort());
    expect(view.benchmark?.name).toBe("iShares Core MSCI World UCITS ETF Acc");

    expect(await db.select().from(userWatchlistItems).where(eq(userWatchlistItems.userId, userId))).toHaveLength(2);
    expect(await db.select().from(userPriceAlerts).where(eq(userPriceAlerts.userId, userId))).toHaveLength(2);
    expect(await db.select().from(investmentTaxCarryforwards).where(eq(investmentTaxCarryforwards.userId, userId))).toHaveLength(carryforwards);
  });
});
