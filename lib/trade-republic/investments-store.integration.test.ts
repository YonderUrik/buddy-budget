import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, client } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { brokerImportAccounts } from "@/lib/db/schema/broker-import-accounts";
import { instruments, investmentPortfolios, investmentTransactions } from "@/lib/db/schema/investments";
// No network: no verified listing for the ISIN, so the instrument is created manual in EUR, as a statement import would.
vi.mock("@/lib/market-data/runtime", () => ({
  searchInstrumentsOnProviders: vi.fn().mockResolvedValue([]), searchCryptoOnProviders: vi.fn().mockResolvedValue([]),
  searchByIsinOnProviders: vi.fn().mockResolvedValue({ status: "empty", hits: [] }),
  quoteMetaOnProviders: vi.fn().mockResolvedValue(null), listingsOnOpenFigi: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/investments/history", () => ({ ensureHistorySafely: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/investments/link-quotation", () => ({ autoLinkQuotation: vi.fn().mockResolvedValue(null) }));
import { saveTradeRepublicInvestments, tradeRepublicSourceKey, TRADE_REPUBLIC_API_PROVIDER } from "./investments-store";

const ISIN = "IE00B4L5Y983";
const trade = (eventId: string, side: "acquisto" | "vendita", quantity: number, date = "2026-03-02") => ({ eventId, eventType: "TRADING_TRADE_EXECUTED", date, isin: ISIN, name: "Core MSCI World", side, quantity, price: 95.5, fees: 1, taxes: 0 });
let userId: string;
beforeEach(async () => {
  userId = `test-tr-inv-${crypto.randomUUID()}`;
  await db.insert(authUser).values({ id: userId, name: "Synthetic TR investor", email: `${userId}@example.com`, currency: "EUR" });
});
afterEach(async () => {
  await db.delete(authUser).where(eq(authUser.id, userId));
  await db.delete(instruments).where(eq(instruments.createdByUserId, userId));
});
afterAll(async () => { await client.end(); });

describe("direct Trade Republic investments", () => {
  it("creates one portfolio and source, and replaces the operations on every sync without duplicating them", async () => {
    const data = { trades: [trade("a", "acquisto", 2), trade("b", "acquisto", 1, "2026-04-01")], positions: new Map([[ISIN, 3]]) };
    expect(await saveTradeRepublicInvestments(userId, "hash", data)).toEqual({ operations: 2, instrumentsCreated: 1, positionsChecked: true });
    await saveTradeRepublicInvestments(userId, "hash", { ...data, trades: [...data.trades, trade("c", "vendita", 1, "2026-05-01")], positions: new Map([[ISIN, 2]]) });
    const ops = await db.select().from(investmentTransactions).where(eq(investmentTransactions.userId, userId));
    expect(ops.map((op) => op.type).sort()).toEqual(["acquisto", "acquisto", "vendita"]);
    expect(new Set(ops.map((op) => op.statementAccountKey))).toEqual(new Set([tradeRepublicSourceKey("hash")]));
    expect(await db.select().from(investmentPortfolios).where(eq(investmentPortfolios.userId, userId))).toHaveLength(1);
    const [source] = await db.select().from(brokerImportAccounts).where(and(eq(brokerImportAccounts.userId, userId)));
    expect(source).toMatchObject({ provider: TRADE_REPUBLIC_API_PROVIDER, cashAccountId: null });
  });
  it("writes nothing when quantities disagree with Trade Republic or a sale would oversell", async () => {
    await expect(saveTradeRepublicInvestments(userId, "hash", { trades: [trade("a", "acquisto", 2)], positions: new Map([[ISIN, 5]]) })).rejects.toThrow("invalid-response");
    await expect(saveTradeRepublicInvestments(userId, "hash", { trades: [trade("a", "vendita", 1)], positions: null })).rejects.toThrow("invalid-response");
    expect(await db.select().from(investmentTransactions).where(eq(investmentTransactions.userId, userId))).toHaveLength(0);
  });
});
