import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { accounts } from "@/lib/db/schema/accounts";
import { transactions } from "@/lib/db/schema/transactions";
import { brokerStatements } from "@/lib/db/schema/broker-statements";
import { investmentTransactions, instruments } from "@/lib/db/schema/investments";
import { createOrReuseInstrument } from "../instruments";
import { runStatementImport } from "./execute-statement";
import { deleteStatementImports } from "./delete-statements";
import { previewInvestmentReset, resetInvestmentHistory } from "./reset";
import { tradeRepublicCsv, trRows } from "./__fixtures__/trade-republic";
import { parseTradeRepublic } from "./trade-republic";
import type { RunImportInput } from "@/lib/validation/investments-import";
import type { ImportDeps } from "./execute";
const users: string[] = [];
let userId: string;
const deps = (): ImportDeps => ({ userCurrency: "EUR", todayKey: "2026-10-06", createInstrument: (input) => createOrReuseInstrument(userId, input, { quoteMeta: vi.fn() }), fetchFx: vi.fn(), ensureHistory: vi.fn() });
const request = (csv = tradeRepublicCsv(), dryRun = false): RunImportInput => {
  const parsed = parseTradeRepublic(csv, '2026-10-06');
  return { statementCsv: csv, dryRun, operations: parsed.operations, instruments: parsed.identities.map((i) => ({ key: i.key, create: { source: 'manuale', name: i.name!, currency: i.currency!, type: 'crypto' } })) };
};
const movements = () => db.select().from(transactions).where(eq(transactions.userId, userId));
const documents = () => db.select().from(brokerStatements).where(eq(brokerStatements.userId, userId));
beforeEach(async () => {
  userId = randomUUID(); users.push(userId);
  await db.insert(authUser).values({ id: userId, name: 'Synthetic TR import', email: `${userId}@example.test` });
});
afterAll(async () => {
  await db.delete(transactions).where(inArray(transactions.userId, users));
  await db.delete(investmentTransactions).where(inArray(investmentTransactions.userId, users));
  await db.delete(instruments).where(inArray(instruments.createdByUserId, users));
  await db.delete(authUser).where(inArray(authUser.id, users));
});
describe('Trade Republic persistence', () => {
  it('previews without writes, imports investments and cash once, preserves categorization and notes on update', async () => {
    expect((await runStatementImport(userId, request(undefined, true), deps())).counts.new).toBe(8);
    expect(await movements()).toHaveLength(0);
    expect(await documents()).toHaveLength(0);
    expect((await runStatementImport(userId, request(), deps())).inserted).toBe(8);
    expect(await movements()).toHaveLength(6);
    expect(await db.select().from(investmentTransactions).where(eq(investmentTransactions.userId, userId))).toHaveLength(2);
    expect((await db.select().from(accounts).where(eq(accounts.userId, userId)))[0].balance).toBe('774.40');
    expect((await runStatementImport(userId, request(), deps())).counts.duplicate).toBe(8);
    const card = (await movements()).find((m) => m.merchantCategoryCode === '5411')!;
    await db.update(transactions).set({ note: 'Keep note', excludedAmount: '-5.00' }).where(eq(transactions.id, card.id));
    const updated = tradeRepublicCsv([...trRows, { type: 'REFERRAL', amount: '10', date: '2024-01-02', datetime: '2024-01-02T12:00:00Z' }]);
    expect((await runStatementImport(userId, request(updated), deps())).inserted).toBe(9);
    expect(await movements()).toHaveLength(7);
    expect((await movements()).find((m) => m.id === card.id)).toMatchObject({ note: 'Keep note', excludedAmount: '-5.00', categoryId: card.categoryId });
    expect((await documents())).toHaveLength(1);
    expect((await runStatementImport(userId, request(), deps())).error).toContain('storico completo');
    const doc = (await documents())[0];
    expect((await deleteStatementImports(userId, doc.id, [doc.id], deps())).status).toBe(200);
    expect(await movements()).toHaveLength(0);
  });
  it('imports cash-only exports and resets their transactions atomically', async () => {
    const cash = tradeRepublicCsv(trRows.filter((r) => r.category !== 'TRADING'));
    expect((await runStatementImport(userId, request(cash), deps())).inserted).toBe(6);
    const preview = await previewInvestmentReset(userId);
    expect((await resetInvestmentHistory(userId, preview.revision, '2026-10-06')).status).toBe(200);
    expect(await movements()).toHaveLength(0);
    expect(await documents()).toHaveLength(0);
    expect((await runStatementImport(userId, request(cash), deps())).inserted).toBe(6);
    expect(await db.select().from(accounts).where(eq(accounts.userId, userId))).toHaveLength(1);
  });
});
