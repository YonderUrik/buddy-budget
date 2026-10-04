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
import { parseInteractiveBrokersActivity } from "./interactive-brokers";
import { runStatementImport } from "./execute-statement";
import type { ImportDeps } from "./execute";
import type { RunImportInput } from "@/lib/validation/investments-import";

const users: string[] = [];
let userId: string;
const request = (csv: string, dryRun = false): RunImportInput => {
  const parsed = parseInteractiveBrokersActivity(csv, "2026-10-04");
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
  it("rejects missing history, changed overlapping periods, and broken cash without financial writes", async () => {
    expect((await runStatementImport(userId, request(brokerSeries(2024)), deps())).error).toContain("Saldo iniziale");
    expect(await saved()).toHaveLength(0);
    await runStatementImport(userId, request(brokerSeries(2023)), deps());
    expect((await runStatementImport(userId, request(brokerSeries(2023).replace("Deposit,2000", "Other deposit,2000")), deps())).error).toContain("sovrapposto");
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
});
