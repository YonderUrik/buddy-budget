import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { accounts } from "@/lib/db/schema/accounts";
import { brokerStatements } from "@/lib/db/schema/broker-statements";
import { ibkrFlexConnections } from "@/lib/db/schema/ibkr-flex";
import { fxRates, instruments, investmentTransactions } from "@/lib/db/schema/investments";
import { createOrReuseInstrument } from "@/lib/investments/instruments";
import { flexReport } from "@/lib/investments/import/__fixtures__/ibkr-flex";
import { todayKey } from "@/lib/investments/operations";
import { importNatively } from "@/lib/personal-import/native";
import { listIbkrFlexAccountStatuses, ibkrFlexConnectionForAccount } from "./account-status";
import { connectIbkrFlex, disconnectIbkrFlex, listIbkrFlexConnections } from "./connections";
import { syncIbkrFlexConnection, type IbkrFlexSyncDeps } from "./sync";
import type { IbkrFlexClientDeps } from "./client";
import type { RateWindowStore } from "./rate-limit";
import { netWorthSnapshots } from "@/lib/db/schema/net-worth-snapshots";
import { createMemoryHistoryStateStore } from "@/lib/net-worth/history-state";
import { refreshDerivedCashHistory, writeDailySnapshot } from "@/lib/net-worth/snapshots";

/**
 * The sync against a real Postgres and a fake IBKR endpoint: the endpoint answers SendRequest with a reference code
 * and GetStatement with a synthetic report for exactly the requested `fd`/`td` period. No request leaves the process.
 */

const TOKEN = "111122223333444455556666";
const users: string[] = [];
let userId: string;

const compact = (date: string) => date.replaceAll("-", "");
const memoryStore = (): RateWindowStore => { const counts = new Map<string, number>(); return { increment: async (key) => { const n = (counts.get(key) ?? 0) + 1; counts.set(key, n); return n; } }; };

interface FakeIbkr { client: IbkrFlexClientDeps; periods: { from: string; to: string }[]; fail: number | null; report: (from: string, to: string) => string }
/** Year 2025 carries the activity; any later period is quiet (same cash and position). */
function fakeIbkr(): FakeIbkr {
  const state: FakeIbkr = {
    periods: [], fail: null,
    report: (from, to) => (from === "20250101" && to === "20251231" ? flexReport() : flexReport({ from, to, quiet: true })),
    client: undefined as unknown as IbkrFlexClientDeps,
  };
  let pending: { from: string; to: string } | null = null;
  state.client = {
    rateStore: memoryStore(), sleep: async () => {},
    fetch: (async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      if (url.searchParams.get("t") !== TOKEN) return new Response("<FlexStatementResponse><Status>Fail</Status><ErrorCode>1015</ErrorCode></FlexStatementResponse>");
      if (url.pathname.endsWith("/SendRequest")) {
        if (state.fail) return new Response(`<FlexStatementResponse><Status>Fail</Status><ErrorCode>${state.fail}</ErrorCode></FlexStatementResponse>`);
        pending = { from: url.searchParams.get("fd")!, to: url.searchParams.get("td")! };
        state.periods.push({ ...pending });
        return new Response("<FlexStatementResponse><Status>Success</Status><ReferenceCode>42</ReferenceCode></FlexStatementResponse>");
      }
      return new Response(state.report(pending!.from, pending!.to));
    }) as typeof fetch,
  };
  return state;
}

function syncDeps(ibkr: FakeIbkr): IbkrFlexSyncDeps {
  return {
    client: ibkr.client,
    // The real import with market searches off: securities become manual instruments with the report's ISIN.
    importReport: (owner, xml) => importNatively(owner, xml, {
      importDeps: { userCurrency: "EUR", todayKey: todayKey(), createInstrument: (input) => createOrReuseInstrument(owner, input, { quoteMeta: vi.fn() }), fetchFx: vi.fn(async () => {}), ensureHistory: vi.fn(async () => {}) },
      resolve: async () => ({ kind: "none", reason: "not_found" }),
    }),
    now: () => new Date(),
  };
}

const operationsOf = (owner: string) => db.select().from(investmentTransactions).where(eq(investmentTransactions.userId, owner));
const statementsOf = (owner: string) => db.select({ from: brokerStatements.from, to: brokerStatements.to }).from(brokerStatements).where(eq(brokerStatements.userId, owner)).orderBy(brokerStatements.from);
const connectionOf = async (id: string) => (await db.select().from(ibkrFlexConnections).where(eq(ibkrFlexConnections.id, id)))[0];

beforeAll(async () => {
  process.env.DATA_ENCRYPTION_KEY ??= randomBytes(32).toString("base64");
  // The USD dividend needs an exchange rate on its day (no market source is called in tests).
  await db.insert(fxRates).values(["2025-03-14", "2025-03-15"].map((date) => ({ date, currency: "USD", perEur: "1.1", source: "ecb" as const }))).onConflictDoNothing();
});
beforeEach(async () => {
  userId = randomUUID(); users.push(userId);
  await db.insert(authUser).values({ id: userId, name: "Synthetic IBKR Flex", email: `${userId}@example.test` });
});
afterEach(() => { vi.useRealTimers(); });
afterAll(async () => {
  await db.delete(netWorthSnapshots).where(inArray(netWorthSnapshots.userId, users));
  await db.delete(investmentTransactions).where(inArray(investmentTransactions.userId, users));
  await db.delete(instruments).where(inArray(instruments.createdByUserId, users));
  await db.delete(authUser).where(inArray(authUser.id, users));
});

async function connected(ibkr = fakeIbkr()) {
  const outcome = await connectIbkrFlex(userId, { token: TOKEN, queryId: "123456" }, ibkr.client);
  if (outcome.status !== "connected") throw new Error(`connect refused: ${outcome.reason}`);
  return { ibkr, connectionId: outcome.connectionId };
}

describe("IBKR Flex connection", () => {
  it("checks the credentials with a short report and stores the token encrypted, never exposed", async () => {
    const { ibkr, connectionId } = await connected();
    expect(ibkr.periods).toHaveLength(1);
    const row = await connectionOf(connectionId);
    expect(row.token).toMatch(/^enc:v1:/);
    expect(row.token).not.toContain(TOKEN);
    expect(row).toMatchObject({ accountLabel: "0001", baseCurrency: "EUR", dateOpened: "2025-01-01", status: "linked" });
    const [view] = await listIbkrFlexConnections(userId);
    expect(JSON.stringify(view)).not.toContain(TOKEN);
    expect(view).not.toHaveProperty("token");
    expect(view).not.toHaveProperty("queryId");
  });

  it("refuses an invalid token without storing anything", async () => {
    const outcome = await connectIbkrFlex(userId, { token: "999999999999999999999999", queryId: "1" }, fakeIbkr().client);
    expect(outcome).toEqual({ status: "refused", reason: "token_invalid" });
    expect(await db.select().from(ibkrFlexConnections).where(eq(ibkrFlexConnections.userId, userId))).toHaveLength(0);
  });

  it("reconnecting the same IBKR account replaces the token instead of adding a connection", async () => {
    const { connectionId } = await connected();
    const again = await connectIbkrFlex(userId, { token: TOKEN, queryId: "654321" }, fakeIbkr().client);
    expect(again).toMatchObject({ status: "connected", connectionId, reconnected: true });
    expect((await connectionOf(connectionId)).queryId).toBe("654321");
  });
});

describe("syncIbkrFlexConnection", () => {
  it("imports the history from the opening date, oldest first, then the account row shows the connection", async () => {
    const { ibkr, connectionId } = await connected();
    const outcome = await syncIbkrFlexConnection(userId, connectionId, syncDeps(ibkr));
    const through = new Date(Date.parse(`${todayKey()}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
    expect(outcome).toMatchObject({ status: "done", reports: 2, partial: false, through });
    expect(ibkr.periods.slice(1)).toEqual([{ from: "20250101", to: "20251231" }, { from: "20260101", to: compact(through) }]);
    expect(await statementsOf(userId)).toEqual([{ from: "2025-01-01", to: "2025-12-31" }, { from: "2026-01-01", to: through }]);
    const operations = await operationsOf(userId);
    expect(operations.map((o) => o.type).sort()).toEqual(["acquisto", "dividendo"]);
    expect(await connectionOf(connectionId)).toMatchObject({ status: "linked", failures: 0, lastError: null, syncedThrough: through });
    const [status] = await listIbkrFlexAccountStatuses(userId);
    expect(status).toMatchObject({ provider: "ibkr-flex", connectionId, status: "linked" });
    const [cash] = await db.select().from(accounts).where(and(eq(accounts.userId, userId), eq(accounts.id, status.accountId)));
    expect(cash.type).toBe("Liquidità broker");
    expect(await ibkrFlexConnectionForAccount(userId, status.accountId)).toBe(connectionId);
  });

  it("the cash history follows the broker account day by day from its statements, not today's balance", async () => {
    const { ibkr, connectionId } = await connected();
    await syncIbkrFlexConnection(userId, connectionId, syncDeps(ibkr));
    await writeDailySnapshot(userId);
    await refreshDerivedCashHistory(userId, new Date(), createMemoryHistoryStateStore());
    const rows = await db.select().from(netWorthSnapshots).where(and(eq(netWorthSnapshots.userId, userId), eq(netWorthSnapshots.assetClass, "liquidita"))).orderBy(netWorthSnapshots.date);
    const on = (date: string) => rows.find((r) => r.date === date);
    // 2,000 EUR deposited on the first day, 1,001 spent on the ETF the next one.
    expect(on("2025-01-01")).toMatchObject({ amount: "2000.00", statementAmount: "2000.00", source: "derivato" });
    expect(on("2025-01-02")).toMatchObject({ amount: "999.00" });
    // Year end: 597.25 EUR and 442.50 USD at 1.1.
    expect(on("2025-12-31")).toMatchObject({ amount: "999.52", statementAmount: "999.52" });
    // Today counts the account's balance once, as its statement part.
    expect(rows.at(-1)).toMatchObject({ date: todayKey(), source: "snapshot", amount: "999.52", statementAmount: "999.52" });
  });

  it("is idempotent: the next day replaces the latest period whole, without duplicating operations", async () => {
    const { ibkr, connectionId } = await connected();
    await syncIbkrFlexConnection(userId, connectionId, syncDeps(ibkr));
    const before = await operationsOf(userId);
    expect(await syncIbkrFlexConnection(userId, connectionId, syncDeps(ibkr))).toMatchObject({ status: "done", reports: 0 });
    vi.useFakeTimers({ toFake: ["Date"], now: Date.now() + 86_400_000 });
    const next = await syncIbkrFlexConnection(userId, connectionId, syncDeps(ibkr));
    expect(next).toMatchObject({ status: "done", reports: 1 });
    expect(ibkr.periods.at(-1)!.from).toBe("20260101");
    expect(await statementsOf(userId)).toHaveLength(2);
    expect((await operationsOf(userId)).map((o) => o.id).sort()).toEqual(before.map((o) => o.id).sort());
  });

  it("never saves a report that does not reconcile, keeps the history and backs off", async () => {
    const { ibkr, connectionId } = await connected();
    await syncIbkrFlexConnection(userId, connectionId, syncDeps(ibkr));
    const statements = await statementsOf(userId);
    const operations = await operationsOf(userId);
    vi.useFakeTimers({ toFake: ["Date"], now: Date.now() + 86_400_000 });
    // An incomplete report: the position IBKR holds is missing.
    ibkr.report = (from, to) => flexReport({ from, to, quiet: true, position: 0 });
    const outcome = await syncIbkrFlexConnection(userId, connectionId, syncDeps(ibkr));
    expect(outcome).toMatchObject({ status: "failed", reason: "import_refused", expired: false });
    expect(await statementsOf(userId)).toEqual(statements);
    expect((await operationsOf(userId)).length).toBe(operations.length);
    const row = await connectionOf(connectionId);
    expect(row).toMatchObject({ status: "linked", lastError: "import_refused", failures: 1 });
    expect(row.lastErrorDetail).toMatch(/Posizione/);
    expect(row.nextAttemptAt!.getTime()).toBeGreaterThan(Date.now() + 59 * 60_000);
  });

  it("marks an expired token, clears it and stops the automatic syncs", async () => {
    const { ibkr, connectionId } = await connected();
    ibkr.fail = 1012;
    expect(await syncIbkrFlexConnection(userId, connectionId, syncDeps(ibkr))).toEqual({ status: "failed", reason: "token_expired", expired: true });
    expect(await connectionOf(connectionId)).toMatchObject({ status: "expired", token: "", lastError: "token_expired", nextAttemptAt: null });
    expect(await syncIbkrFlexConnection(userId, connectionId, syncDeps(ibkr))).toMatchObject({ status: "failed", expired: true });
  });

  it("refuses a report of another account", async () => {
    const { ibkr, connectionId } = await connected();
    ibkr.report = (from, to) => flexReport({ from, to, quiet: true, account: "U90000999" });
    expect(await syncIbkrFlexConnection(userId, connectionId, syncDeps(ibkr))).toMatchObject({ status: "failed", reason: "account_changed" });
    expect(await statementsOf(userId)).toEqual([]);
  });

  it("only the owner can sync, see or disconnect a connection", async () => {
    const { ibkr, connectionId } = await connected();
    const owner = userId;
    const other = randomUUID(); users.push(other);
    await db.insert(authUser).values({ id: other, name: "Someone else", email: `${other}@example.test` });
    expect(await syncIbkrFlexConnection(other, connectionId, syncDeps(ibkr))).toEqual({ status: "not-found" });
    expect(await listIbkrFlexConnections(other)).toEqual([]);
    expect(await disconnectIbkrFlex(other, connectionId)).toBe(false);
    expect(await disconnectIbkrFlex(owner, connectionId)).toBe(true);
    expect(await db.select().from(ibkrFlexConnections).where(eq(ibkrFlexConnections.id, connectionId))).toHaveLength(0);
  });
});
