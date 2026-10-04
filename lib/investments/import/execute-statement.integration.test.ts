import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { accounts } from "@/lib/db/schema/accounts";
import { brokerStatements } from "@/lib/db/schema/broker-statements";
import { instruments, investmentTransactions, userInstrumentPrices } from "@/lib/db/schema/investments";
import { createOrReuseInstrument } from "../instruments";
import { brokerSeries } from "./__fixtures__/broker-series";
import { parseBrokerStatement } from "./parse-statement";
import { deleteStatementImports } from "./delete-statements";
import { runStatementImport } from "./execute-statement";
import type { ImportDeps } from "./execute";
import type { RunImportInput } from "@/lib/validation/investments-import";

const users: string[] = [];
let userId: string;
const request = (csv: string, dryRun = false): RunImportInput => {
  const parsed = parseBrokerStatement(csv, "2026-10-04");
  return { statementCsv: csv, dryRun, operations: parsed.operations, instruments: parsed.identities.map((i) => ({ key: i.key, create: { source: "manuale", name: i.name!, isin: i.isin!, currency: i.currency!, type: "azione" } })) };
};
const deps = (id = userId): ImportDeps => ({ userCurrency: "EUR", todayKey: "2026-10-04", createInstrument: (input) => createOrReuseInstrument(id, input, { quoteMeta: vi.fn() }), fetchFx: vi.fn(async () => {}), ensureHistory: vi.fn(async () => {}) });
const saved = () => db.select().from(brokerStatements).where(eq(brokerStatements.userId, userId));
beforeEach(async () => {
  userId = randomUUID(); users.push(userId);
  await db.insert(authUser).values({ id: userId, name: "Synthetic import", email: `${userId}@example.test` });
});
afterAll(async () => {
  // Only rows belonging to the users created by this test run.
  await db.delete(investmentTransactions).where(inArray(investmentTransactions.userId, users));
  await db.delete(instruments).where(inArray(instruments.createdByUserId, users));
  await db.delete(authUser).where(inArray(authUser.id, users));
});

describe("complete statement import", () => {
  it("uses DEGIRO execution FX while keeping EUR fees in EUR", async () => {
    const csv = readFileSync(new URL("./__fixtures__/degiro-fx.csv", import.meta.url), "utf8");
    const dependencies = deps();
    expect((await runStatementImport(userId, request(csv), dependencies)).inserted).toBe(1);
    const [trade] = await db.select().from(investmentTransactions).where(eq(investmentTransactions.userId, userId));
    expect(Number(trade.fxRate)).toBe(0.9);
    expect(Number(trade.fees)).toBe(3);
    expect(Number(trade.price)).toBe(100);
    expect(Number((await db.select().from(accounts).where(eq(accounts.userId, userId)))[0].balance)).toBe(817);
    expect(dependencies.fetchFx).not.toHaveBeenCalled();
  });
  it("previews without writes, imports consecutive periods and preserves broker balances and all closing prices", async () => {
    const first = request(brokerSeries(2023));
    expect((await runStatementImport(userId, { ...first, dryRun: true }, deps())).counts.error).toBe(0);
    expect(await saved()).toHaveLength(0);
    expect(await db.select().from(instruments).where(eq(instruments.createdByUserId, userId))).toHaveLength(0);
    expect((await runStatementImport(userId, first, deps())).inserted).toBe(1);
    expect((await runStatementImport(userId, request(brokerSeries(2024), true), deps())).counts.error).toBe(0);
    expect((await runStatementImport(userId, request(brokerSeries(2024)), deps())).inserted).toBe(3);
    expect(await saved()).toHaveLength(2);
    expect((await db.select().from(accounts).where(eq(accounts.userId, userId)))[0].balance).toBe("1108.00");
    expect(await db.select().from(userInstrumentPrices).where(eq(userInstrumentPrices.userId, userId))).toHaveLength(2);
    expect((await runStatementImport(userId, first, deps())).inserted).toBe(0);
  });
  it("serializes concurrent copies of the same statement", async () => {
    const results = await Promise.all([runStatementImport(userId, request(brokerSeries(2023)), deps()), runStatementImport(userId, request(brokerSeries(2023)), deps())]);
    expect(results.map((r) => r.inserted).sort()).toEqual([0, 1]);
    expect(await saved()).toHaveLength(1);
  });
  it("rejects missing history and broken cash without financial writes", async () => {
    expect((await runStatementImport(userId, request(brokerSeries(2024)), deps())).error).toContain("Saldo iniziale");
    expect(await saved()).toHaveLength(0);
    await runStatementImport(userId, request(brokerSeries(2023)), deps());
    expect((await runStatementImport(userId, request(brokerSeries(2023).replace("Deposit,2000", "Other deposit,2000")), deps())).replacement?.statements).toBe(1);
    expect((await runStatementImport(userId, request(brokerSeries(2024).replace("Ending Cash,EUR,1108", "Ending Cash,EUR,1109")), deps())).error).toContain("Cassa");
    expect(await saved()).toHaveLength(1);
  });
  it("ignores client changes to operations and refuses missing instrument selections", async () => {
    const input = request(brokerSeries(2023)); input.operations[0].quantity = 9999;
    expect((await runStatementImport(userId, input, deps())).inserted).toBe(1);
    const rows = await db.select().from(investmentTransactions).where(eq(investmentTransactions.userId, userId));
    expect(Number(rows[0].quantity)).toBe(10);
    const next = request(brokerSeries(2024)); next.instruments = [];
    expect((await runStatementImport(userId, next, deps())).error).toContain("abbina tutti");
  });
  it("isolates private instruments and statements between users with identical broker files", async () => {
    const other = randomUUID(); users.push(other);
    await db.insert(authUser).values({ id: other, name: "Second synthetic user", email: `${other}@example.test` });
    expect((await runStatementImport(userId, request(brokerSeries(2023)), deps())).inserted).toBe(1);
    expect((await runStatementImport(other, request(brokerSeries(2023)), deps(other))).inserted).toBe(1);
    const owned = await db.select().from(instruments).where(inArray(instruments.createdByUserId, [userId, other]));
    expect(owned).toHaveLength(2);
    const bad = request(brokerSeries(2024)); bad.instruments = bad.instruments.map((i) => ({ key: i.key, instrumentId: owned.find((i) => i.createdByUserId === other)!.id }));
    expect((await runStatementImport(userId, bad, deps())).error).toContain("accessibile");
  });
  it("replaces an extending YTD statement, previews without mutation, and removes superseded closing prices", async () => {
    const old = brokerSeries(2023).replace("December 31, 2023", "June 30, 2023");
    await runStatementImport(userId, request(old), deps());
    const before = await saved();
    const updated = brokerSeries(2023).replace("PARENT,10,1001,100,1000,-1", "PARENT,10,1001,105,1050,49").replace("Stock,0,1000", "Stock,0,1050").replace("Total,0,1999", "Total,0,2049");
    const preview = await runStatementImport(userId, request(updated, true), deps());
    expect(preview.replacement).toMatchObject({ statements: 1, operations: 1 });
    expect((await saved())[0].id).toBe(before[0].id);
    expect((await runStatementImport(userId, request(updated), deps())).inserted).toBe(1);
    expect(await saved()).toHaveLength(1);
    const prices = await db.select().from(userInstrumentPrices).where(eq(userInstrumentPrices.userId, userId));
    expect(prices).toHaveLength(1); expect(prices[0].date).toBe("2023-12-31"); expect(Number(prices[0].close)).toBe(105);
    expect((await runStatementImport(userId, request(updated), deps())).inserted).toBe(0);
  });
  it("keeps later imports and their latest cash balance when correcting an older compatible period", async () => {
    await runStatementImport(userId, request(brokerSeries(2023)), deps());
    await runStatementImport(userId, request(brokerSeries(2024)), deps());
    const corrected = brokerSeries(2023).replace("Deposit,2000", "Corrected description,2000");
    expect((await runStatementImport(userId, request(corrected), deps())).replacement?.statements).toBe(1);
    expect(await saved()).toHaveLength(2);
    expect((await db.select().from(accounts).where(eq(accounts.userId, userId)))[0].balance).toBe("1108.00");
    const incompatible = corrected.replace("Deposit,2000", "Deposit,2001").replace("Corrected description,2000", "Corrected description,2001").replace("Ending Cash,EUR,999", "Ending Cash,EUR,1000").replace("Cash,0,999", "Cash,0,1000").replace("Total,0,1999", "Total,0,2000");
    expect((await runStatementImport(userId, request(incompatible), deps())).error).toContain("successivo");
    expect((await saved()).find((d) => d.from === "2023-01-01")!.statement.cash[0].closing).toBe(999);
  });
  it("rejects partial coverage and invalid replacements without deleting the original", async () => {
    await runStatementImport(userId, request(brokerSeries(2023)), deps());
    const id = (await saved())[0].id;
    expect((await runStatementImport(userId, request(brokerSeries(2023).replace("December 31, 2023", "June 30, 2023")), deps())).error).toContain("parziale");
    expect((await runStatementImport(userId, request(brokerSeries(2023).replace('10,100,-1000', '11,100,-1000')), deps())).error).toContain("quantità");
    expect((await saved())[0].id).toBe(id);
  });
  it("rolls back removed rows if a replacement insert fails", async () => {
    await runStatementImport(userId, request(brokerSeries(2023)), deps());
    const id = (await saved())[0].id;
    await expect(runStatementImport(userId, request(brokerSeries(2023).replace('10,100,-1000', '10,1e25,-1000')), deps())).rejects.toThrow();
    expect((await saved())[0].id).toBe(id);
    const trades = await db.select().from(investmentTransactions).where(eq(investmentTransactions.userId, userId));
    expect(trades).toHaveLength(1); expect(Number(trades[0].price)).toBe(100);
  });
  it("deletes only the reviewed suffix and restores the preceding cash balance", async () => {
    await runStatementImport(userId, request(brokerSeries(2023)), deps());
    await runStatementImport(userId, request(brokerSeries(2024)), deps());
    const docs = await saved(); const latest = docs.find((d) => d.from === "2024-01-01")!;
    expect((await deleteStatementImports(userId, latest.id, [], deps())).status).toBe(409);
    expect((await deleteStatementImports(randomUUID(), latest.id, [latest.id], deps())).status).toBe(404);
    expect((await deleteStatementImports(userId, latest.id, [latest.id], deps())).deletedOperations).toBe(3);
    expect(await saved()).toHaveLength(1);
    expect((await db.select().from(accounts).where(eq(accounts.userId, userId)))[0].balance).toBe("999.00");
    expect((await runStatementImport(userId, request(brokerSeries(2024)), deps())).inserted).toBe(3);
  });
  it("requires confirmation of dependent imports before clearing the whole history", async () => {
    await runStatementImport(userId, request(brokerSeries(2023)), deps());
    await runStatementImport(userId, request(brokerSeries(2024)), deps());
    const docs = await saved(); const first = docs.find((d) => d.from === "2023-01-01")!;
    expect((await deleteStatementImports(userId, first.id, [first.id], deps())).status).toBe(409);
    expect(await saved()).toHaveLength(2);
    expect((await deleteStatementImports(userId, first.id, docs.map((d) => d.id), deps())).deletedStatements).toBe(2);
    expect(await saved()).toHaveLength(0);
    expect(await db.select().from(investmentTransactions).where(eq(investmentTransactions.userId, userId))).toHaveLength(0);
    expect((await db.select().from(accounts).where(eq(accounts.userId, userId)))[0].balance).toBe("0.00");
    expect((await runStatementImport(userId, request(brokerSeries(2023)), deps())).inserted).toBe(1);
    const cashAccounts = await db.select().from(accounts).where(eq(accounts.userId, userId));
    expect(cashAccounts).toHaveLength(1); expect(cashAccounts[0].balance).toBe("999.00");
  });

  it("replaces several covered periods and serializes concurrent replacements", async () => {
    await runStatementImport(userId, request(brokerSeries(2023)), deps());
    await runStatementImport(userId, request(brokerSeries(2024)), deps());
    const combined = brokerSeries(2024)
      .replace("January 1, 2024 - December 31, 2024", "January 1, 2023 - December 31, 2024")
      .replace("Starting Cash,EUR,999", "Starting Cash,EUR,0")
      .replace("Commissions,EUR,-1", "Commissions,EUR,-2")
      .replace('Trades,Data,Order,Stocks,EUR,CHILD', 'Trades,Data,Order,Stocks,EUR,PARENT,"2023-01-02, 10:00:00",10,100,-1000,-1,1001,O\nTrades,Data,Order,Stocks,EUR,CHILD')
      + '\nDeposits & Withdrawals,Header,Currency,Settle Date,Description,Amount\nDeposits & Withdrawals,Data,EUR,2023-01-01,Deposit,2000';
    const results = await Promise.all([runStatementImport(userId, request(combined), deps()), runStatementImport(userId, request(combined), deps())]);
    expect(results.map((r) => r.inserted).sort()).toEqual([0, 4]);
    expect(results.find((r) => r.inserted)?.replacement).toMatchObject({ statements: 2, operations: 4 });
    expect(await saved()).toHaveLength(1);
    expect((await db.select().from(accounts).where(eq(accounts.userId, userId)))[0].balance).toBe("1108.00");
  });

  it("does not delete another broker account belonging to the same user", async () => {
    await runStatementImport(userId, request(brokerSeries(2023, "U90000001")), deps());
    await runStatementImport(userId, request(brokerSeries(2023, "U90000002")), deps());
    const selected = (await saved()).find((d) => d.statement.account === "U90000001")!;
    await deleteStatementImports(userId, selected.id, [selected.id], deps());
    const retained = await saved(); expect(retained).toHaveLength(1); expect(retained[0].statement.account).toBe("U90000002");
    expect(await db.select().from(investmentTransactions).where(eq(investmentTransactions.userId, userId))).toHaveLength(1);
  });

  it("shares a portfolio while replacements and deletion stay scoped to the originating broker", async () => {
    const degiro = readFileSync(new URL("./__fixtures__/degiro-account.csv", import.meta.url), "utf8");
    await runStatementImport(userId, request(brokerSeries(2023)), deps());
    const ib = (await saved())[0];
    // Exercise upgrade compatibility with IBKR transactions created before source attribution existed.
    await db.update(investmentTransactions).set({ statementAccountKey: null }).where(eq(investmentTransactions.userId, userId));
    const input = { ...request(degiro), portfolioId: ib.portfolioId };
    expect((await runStatementImport(userId, input, deps())).inserted).toBe(3);
    const dg = (await saved()).find((d) => d.statement.provider === "degiro")!;
    expect(dg.portfolioId).toBe(ib.portfolioId); expect(dg.cashAccountId).not.toBe(ib.cashAccountId);
    expect((await runStatementImport(userId, input, deps())).inserted).toBe(0);
    const replacement = await runStatementImport(userId, { ...request(degiro.replaceAll("Synthetic Parent", "Synthetic Updated")), portfolioId: ib.portfolioId }, deps());
    expect(replacement.replacement).toMatchObject({ statements: 1, operations: 3 });
    expect((await saved()).some((d) => d.id === ib.id)).toBe(true);
    const dgTradesBefore = (await db.select().from(investmentTransactions).where(eq(investmentTransactions.userId, userId))).filter((t) => t.statementAccountKey === dg.accountKey).map((t) => t.id).sort();
    const ibReplacement = await runStatementImport(userId, request(brokerSeries(2023).replace("Deposit,2000", "Corrected deposit,2000")), deps());
    expect(ibReplacement.replacement).toMatchObject({ statements: 1, operations: 1 });
    const dgTradesAfter = (await db.select().from(investmentTransactions).where(eq(investmentTransactions.userId, userId))).filter((t) => t.statementAccountKey === dg.accountKey).map((t) => t.id).sort();
    expect(dgTradesAfter).toEqual(dgTradesBefore);
    const freshDg = (await saved()).find((d) => d.statement.provider === "degiro")!;
    expect((await deleteStatementImports(userId, freshDg.id, [freshDg.id], deps())).deletedOperations).toBe(3);
    expect(await saved()).toHaveLength(1);
    expect(await db.select().from(investmentTransactions).where(eq(investmentTransactions.userId, userId))).toHaveLength(1);
    expect((await db.select().from(accounts).where(eq(accounts.id, ib.cashAccountId!)))[0].balance).toBe("999.00");
    expect((await runStatementImport(userId, input, deps())).inserted).toBe(3);
    expect(await db.select().from(accounts).where(eq(accounts.userId, userId))).toHaveLength(2);
    const freshIb = (await saved()).find((d) => d.statement.provider !== "degiro")!;
    expect((await deleteStatementImports(userId, freshIb.id, [freshIb.id], deps())).deletedOperations).toBe(1);
    expect((await saved())[0].statement.provider).toBe("degiro");
    expect(await db.select().from(investmentTransactions).where(eq(investmentTransactions.userId, userId))).toHaveLength(3);
  });

});
