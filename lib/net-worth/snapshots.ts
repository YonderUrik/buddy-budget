import { and, eq, gt, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { transactions } from "@/lib/db/schema/transactions";
import { netWorthSnapshots } from "@/lib/db/schema/net-worth-snapshots";
import { personalFormats } from "@/lib/db/schema/personal-imports";
import { toDateKey, addDays } from "@/lib/calc/net-worth";
import { startOfDay } from "@/lib/calc/expenses";
import { ledgerAmountToday, planCashHistory, type LedgerAccount, type LedgerTransaction } from "@/lib/calc/cash-history";
import { hashUserId, logger } from "@/lib/observability";
import type { InvestmentHistoryStateStore } from "./history-state";
import { redisCashHistoryStateStore } from "./redis-history-state";

/** Reads run in the rebuild's transaction when there is one. */
type Reader = Pick<typeof db, "select">;

/** Batch size of the cash history upserts. */
const CASH_WRITE_BATCH_SIZE = 500;
/** Second key of the per-user advisory lock that serialises cash history rebuilds (cron and read endpoint). */
const CASH_HISTORY_LOCK_KEY = 61804;

/**
 * True se l'utente ha già almeno una riga di liquidità, reale o derivata. Le righe "investimenti" non contano:
 * hanno una ricostruzione propria, e non devono impedire quella della liquidità.
 */
export async function hasAnySnapshot(userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: netWorthSnapshots.id })
    .from(netWorthSnapshots)
    .where(and(eq(netWorthSnapshots.userId, userId), eq(netWorthSnapshots.assetClass, "liquidita")))
    .limit(1);
  return rows.length > 0;
}

/** Ids of the accounts a personal file import writes to: their balance moves with the imported transactions. */
export async function importAccountIds(userId: string, reader: Reader = db): Promise<Set<string>> {
  const rows = await reader
    .select({ accountId: personalFormats.accountId })
    .from(personalFormats)
    .where(and(eq(personalFormats.userId, userId), isNotNull(personalFormats.accountId)));
  return new Set(rows.map((r) => r.accountId!));
}

/** The user's accounts split into ledger accounts (bank-synced or file-imported) and the sum of the manual ones. */
async function loadLedgerAccounts(userId: string, reader: Reader = db): Promise<{ ledger: LedgerAccount[]; manualNow: number }> {
  const [userAccounts, imported] = await Promise.all([
    reader.select({ id: accounts.id, source: accounts.source, balance: accounts.balance, createdAt: accounts.createdAt }).from(accounts).where(eq(accounts.userId, userId)),
    importAccountIds(userId, reader),
  ]);
  const ledger: LedgerAccount[] = [];
  let manualNow = 0;
  for (const a of userAccounts) {
    if (a.source === "auto" || imported.has(a.id)) ledger.push({ id: a.id, kind: a.source === "auto" ? "auto" : "import", balance: Number(a.balance), createdAt: a.createdAt });
    else manualNow += Number(a.balance);
  }
  return { ledger, manualNow };
}

async function loadLedgerTransactions(userId: string, ledger: LedgerAccount[], afterKey?: string, reader: Reader = db): Promise<LedgerTransaction[]> {
  if (ledger.length === 0) return [];
  const rows = await reader
    .select({ accountId: transactions.accountId, date: transactions.date, amount: transactions.amount, createdAt: transactions.createdAt })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), inArray(transactions.accountId, ledger.map((a) => a.id)), afterKey ? gt(transactions.date, afterKey) : undefined));
  return rows.map((r) => ({ accountId: r.accountId, date: r.date, amount: Number(r.amount), createdAt: r.createdAt }));
}

/**
 * Fingerprint of everything the cash history depends on: balances and import links of the accounts, the user's
 * transactions (count and latest change, so inserts, edits and deletes all count), rows still without a ledger part,
 * and yesterday's date (so every new day is covered once).
 */
export async function cashInputsFingerprint(userId: string, todayKey: string, yesterdayKey: string): Promise<string> {
  const [[account], [transaction], [formats], [legacy]] = await Promise.all([
    db
      .select({ marker: sql<string>`count(*)::text || ':' || coalesce(sum(${accounts.balance}), 0)::text || ':' || coalesce(max(${accounts.updatedAt})::text, '')` })
      .from(accounts)
      .where(eq(accounts.userId, userId)),
    db
      .select({ marker: sql<string>`count(*)::text || ':' || coalesce(max(${transactions.updatedAt})::text, '') || ':' || coalesce(sum(${transactions.amount}), 0)::text` })
      .from(transactions)
      .where(eq(transactions.userId, userId)),
    db
      .select({ marker: sql<string>`coalesce(string_agg(${personalFormats.accountId}::text, ',' order by ${personalFormats.accountId}), '')` })
      .from(personalFormats)
      .where(and(eq(personalFormats.userId, userId), isNotNull(personalFormats.accountId))),
    db
      .select({ count: sql<string>`count(*)::text` })
      .from(netWorthSnapshots)
      .where(and(eq(netWorthSnapshots.userId, userId), eq(netWorthSnapshots.assetClass, "liquidita"), lt(netWorthSnapshots.date, todayKey), sql`${netWorthSnapshots.ledgerAmount} is null`)),
  ]);
  return [account?.marker, transaction?.marker, formats?.marker, legacy?.count, yesterdayKey].join("|");
}

async function readFingerprint(state: InvestmentHistoryStateStore, userId: string): Promise<string | null> {
  try {
    return await state.get(userId);
  } catch (error) {
    logger.warn("net_worth.history_state.unavailable", { user: hashUserId(userId), error });
    return null;
  }
}

async function saveFingerprint(state: InvestmentHistoryStateStore, userId: string, fingerprint: string): Promise<void> {
  try {
    await state.set(userId, fingerprint);
  } catch (error) {
    logger.warn("net_worth.history_state.unavailable", { user: hashUserId(userId), error });
  }
}

/**
 * Keeps the past cash history in step with the transactions of bank and file-import accounts (see
 * `lib/calc/cash-history.ts`): a bank connected later, an imported file, an edited or deleted transaction all move
 * every day they touch, and missing days of the reconstruction window (first transaction, at most 24 months back)
 * get a `derivato` row. Manual accounts keep the balance each row recorded. Runs only when the inputs changed since
 * the last run; today's row is left to the daily snapshot. Returns the rows written.
 */
export async function refreshDerivedCashHistory(
  userId: string,
  today: Date = new Date(),
  state: InvestmentHistoryStateStore = redisCashHistoryStateStore
): Promise<number> {
  const todayStart = startOfDay(today);
  const todayKey = toDateKey(todayStart);
  const fingerprint = await cashInputsFingerprint(userId, todayKey, toDateKey(addDays(todayStart, -1)));
  if ((await readFingerprint(state, userId)) === fingerprint) return 0;

  const started = Date.now();
  const writes = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}), ${CASH_HISTORY_LOCK_KEY})`);
    const { ledger, manualNow } = await loadLedgerAccounts(userId, tx);
    const [ledgerTransactions, rows] = await Promise.all([
      loadLedgerTransactions(userId, ledger, undefined, tx),
      tx
        .select({ date: netWorthSnapshots.date, amount: netWorthSnapshots.amount, ledgerAmount: netWorthSnapshots.ledgerAmount, updatedAt: netWorthSnapshots.updatedAt })
        .from(netWorthSnapshots)
        .where(and(eq(netWorthSnapshots.userId, userId), eq(netWorthSnapshots.assetClass, "liquidita"), lt(netWorthSnapshots.date, todayKey))),
    ]);
    const planned = planCashHistory({
      rows: rows.map((r) => ({ date: r.date, amount: Number(r.amount), ledgerAmount: r.ledgerAmount === null ? null : Number(r.ledgerAmount), updatedAt: r.updatedAt })),
      accounts: ledger,
      transactions: ledgerTransactions,
      manualNow,
      today: todayStart,
    });
    for (let i = 0; i < planned.length; i += CASH_WRITE_BATCH_SIZE) {
      await tx
        .insert(netWorthSnapshots)
        .values(
          planned.slice(i, i + CASH_WRITE_BATCH_SIZE).map((w) => ({
            userId,
            date: w.date,
            assetClass: "liquidita" as const,
            amount: w.amount.toFixed(2),
            ledgerAmount: w.ledgerAmount.toFixed(2),
            source: "derivato" as const,
          }))
        )
        // An existing row keeps its source: a real snapshot stays real, with its ledger part brought up to date.
        .onConflictDoUpdate({
          target: [netWorthSnapshots.userId, netWorthSnapshots.date, netWorthSnapshots.assetClass],
          set: { amount: sql`excluded.amount`, ledgerAmount: sql`excluded.ledger_amount`, updatedAt: new Date() },
        });
    }
    return planned;
  });

  if (writes.length > 0) {
    const inserted = writes.filter((w) => w.insert).length;
    logger.info("net_worth.cash_history.refreshed", { user: hashUserId(userId), inserted, updated: writes.length - inserted, durationMs: Date.now() - started });
  }
  await saveFingerprint(state, userId, fingerprint);
  return writes.length;
}

/**
 * Scrive o aggiorna lo snapshot reale del giorno (liquidità = somma dei saldi correnti) con la sua parte "ledger";
 * sovrascrive sempre una riga derivata.
 */
export async function writeDailySnapshot(userId: string, today: Date = new Date()): Promise<void> {
  const todayKey = toDateKey(startOfDay(today));
  const { ledger, manualNow } = await loadLedgerAccounts(userId);
  const ledgerAmount = ledgerAmountToday(ledger, await loadLedgerTransactions(userId, ledger, todayKey), today);
  const amount = ((Math.round(manualNow * 100) + ledger.reduce((sum, a) => sum + Math.round(a.balance * 100), 0)) / 100).toFixed(2);

  await db
    .insert(netWorthSnapshots)
    .values({ userId, date: todayKey, assetClass: "liquidita", amount, ledgerAmount: ledgerAmount.toFixed(2), source: "snapshot" })
    .onConflictDoUpdate({
      target: [netWorthSnapshots.userId, netWorthSnapshots.date, netWorthSnapshots.assetClass],
      set: { amount, ledgerAmount: ledgerAmount.toFixed(2), source: "snapshot", updatedAt: new Date() },
    });
}
