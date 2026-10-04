import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { accounts } from "@/lib/db/schema/accounts";
import { brokerStatements } from "@/lib/db/schema/broker-statements";
import { instruments, investmentPortfolios, investmentTransactions, userInstrumentPrices } from "@/lib/db/schema/investments";
import { netWorthSnapshots } from "@/lib/db/schema/net-worth-snapshots";
import { createOrReuseInstrument } from "../instruments";
import { brokerSeries } from "./__fixtures__/broker-series";
import { parseBrokerStatement } from "./parse-statement";
import { runStatementImport } from "./execute-statement";
import { previewInvestmentReset, resetInvestmentHistory } from "./reset";

const users: string[] = [];
let userId: string;
async function newUser() {
  const id = randomUUID(); users.push(id);
  await db.insert(authUser).values({ id, name: "Reset test", email: `${id}@example.test` });
  return id;
}
async function importStatement(id: string) {
  const csv = brokerSeries(2023), parsed = parseBrokerStatement(csv, "2026-10-04");
  return runStatementImport(id, { statementCsv: csv, dryRun: false, operations: parsed.operations, instruments: parsed.identities.map((i) => ({ key: i.key, create: { source: "manuale", name: i.name!, isin: i.isin!, currency: i.currency!, type: "azione" } })) }, { userCurrency: "EUR", todayKey: "2026-10-04", createInstrument: (input) => createOrReuseInstrument(id, input, { quoteMeta: vi.fn() }), fetchFx: async () => {}, ensureHistory: async () => {} });
}
beforeEach(async () => { userId = await newUser(); });
afterAll(async () => {
  await db.delete(investmentTransactions).where(inArray(investmentTransactions.userId, users));
  await db.delete(investmentPortfolios).where(inArray(investmentPortfolios.userId, users));
  await db.delete(instruments).where(inArray(instruments.createdByUserId, users));
  await db.delete(authUser).where(inArray(authUser.id, users));
});

describe("full investment import recovery", () => {
  it("clears legacy duplicates, new statements, personal prices and all investment snapshots; preserves unrelated data and supports reimport", async () => {
    await importStatement(userId);
    const other = await newUser(); await importStatement(other);
    const otherBefore = await previewInvestmentReset(other);
    const [original] = await db.select().from(investmentTransactions).where(eq(investmentTransactions.userId, userId));
    const [legacyPortfolio] = await db.insert(investmentPortfolios).values({ userId, name: "Old default portfolio" }).returning();
    await db.insert(investmentTransactions).values({ ...original, id: randomUUID(), portfolioId: legacyPortfolio.id, statementAccountKey: null });
    const [bank] = await db.insert(accounts).values({ userId, name: "Bank untouched", type: "Conto corrente", balance: "1234" }).returning();
    await db.insert(netWorthSnapshots).values([
      { userId, date: "2023-01-01", assetClass: "investimenti", amount: "1000", source: "derivato" },
      { userId, date: "2026-10-04", assetClass: "investimenti", amount: "2000", source: "snapshot" },
      { userId, date: "2023-01-01", assetClass: "liquidita", amount: "1234", source: "snapshot" },
    ]);
    const preview = await previewInvestmentReset(userId);
    expect(preview).toMatchObject({ operations: 2, untrackedOperations: 1, statements: 1, cashAccounts: 1, prices: 1 });
    expect(await resetInvestmentHistory(userId, preview.revision, "2026-10-04")).toMatchObject({ status: 200, deletedOperations: 2, deletedStatements: 1 });
    expect(await db.select().from(investmentTransactions).where(eq(investmentTransactions.userId, userId))).toHaveLength(0);
    expect(await db.select().from(brokerStatements).where(eq(brokerStatements.userId, userId))).toHaveLength(0);
    expect(await db.select().from(userInstrumentPrices).where(eq(userInstrumentPrices.userId, userId))).toHaveLength(0);
    const snapshots = await db.select().from(netWorthSnapshots).where(eq(netWorthSnapshots.userId, userId));
    expect(snapshots.every((s) => s.assetClass === "liquidita" && Number(s.amount) === 1234)).toBe(true);
    const cash = await db.select().from(accounts).where(eq(accounts.userId, userId));
    expect(cash.find((a) => a.id === bank.id)?.balance).toBe("1234.00");
    expect(cash.filter((a) => a.id !== bank.id).every((a) => Number(a.balance) === 0)).toBe(true);
    expect(await previewInvestmentReset(other)).toEqual(otherBefore);
    expect((await importStatement(userId)).inserted).toBe(1);
    expect((await importStatement(userId)).inserted).toBe(0);
    expect(await db.select().from(accounts).where(eq(accounts.userId, userId))).toHaveLength(2);
  });
  it("rejects a stale preview without deleting anything", async () => {
    await importStatement(userId);
    const preview = await previewInvestmentReset(userId);
    await db.update(investmentTransactions).set({ quantity: "5" }).where(eq(investmentTransactions.userId, userId));
    expect(await resetInvestmentHistory(userId, preview.revision, "2026-10-04")).toMatchObject({ status: 409 });
    expect(await db.select().from(brokerStatements).where(eq(brokerStatements.userId, userId))).toHaveLength(1);
  });
  it("binds the preview to its user and permits an empty reset", async () => {
    const other = await newUser();
    const preview = await previewInvestmentReset(userId);
    expect(await resetInvestmentHistory(other, preview.revision, "2026-10-04")).toMatchObject({ status: 409 });
    expect(await resetInvestmentHistory(userId, preview.revision, "2026-10-04")).toMatchObject({ status: 200, deletedOperations: 0 });
  });
});
