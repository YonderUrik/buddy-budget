/**
 * Cash history kept in step with transactions. Pure logic, no database.
 *
 * A "ledger" account is one whose balance follows its transactions: a bank-synced account (`auto`) or the account
 * a personal file import writes to (`import`). For those, the end-of-day balance of any past day is known exactly:
 * current balance minus the transactions dated after that day. Every other account (manual) only has the balance
 * the user typed, which the daily snapshots record as it was.
 *
 * Each stored `liquidita` row keeps `ledgerAmount`, the ledger part of its `amount`. When transactions arrive,
 * change or disappear, the row becomes `amount - ledgerAmount + ledgerOn(day)`: the manual part stays as recorded,
 * the ledger part follows the data. Days without a row inside the window of ledger transactions get a new
 * reconstructed row.
 */

import { addDays, MAX_DERIVED_HISTORY_MONTHS, toDateKey } from "./net-worth";
import { parseDateOnly, startOfDay } from "./expenses";

export type LedgerAccountKind = "auto" | "import";

export interface LedgerAccount {
  id: string;
  kind: LedgerAccountKind;
  balance: number;
  createdAt: Date;
}

export interface LedgerTransaction {
  accountId: string;
  /** YYYY-MM-DD. */
  date: string;
  amount: number;
  createdAt: Date;
}

/** A stored `liquidita` row as the planner needs it. */
export interface StoredCashRow {
  date: string;
  amount: number;
  /** Ledger part of `amount` when the row was last written; null on rows written before the column existed. */
  ledgerAmount: number | null;
  /** When the row was last written: used to estimate the ledger part of rows without `ledgerAmount`. */
  updatedAt: Date;
}

export interface CashHistoryInput {
  rows: StoredCashRow[];
  accounts: LedgerAccount[];
  transactions: LedgerTransaction[];
  /** Sum of the current balances of the non-ledger (manual) accounts. */
  manualNow: number;
  today: Date;
}

/** A row to write: `insert` for a day that had no row, otherwise an update of the existing one. */
export interface CashRowWrite {
  date: string;
  amount: number;
  ledgerAmount: number;
  insert: boolean;
}

const toCents = (value: number) => Math.round(value * 100);
const fromCents = (cents: number) => cents / 100;

/**
 * Ledger balance of each account at the end of each requested day, in cents: balance minus transactions dated after
 * the day. Before an account's first transaction this is its opening balance (zero for an import account).
 */
function ledgerByDay(accounts: LedgerAccount[], transactions: LedgerTransaction[], days: string[]): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>(days.map((d) => [d, new Map()]));
  const descending = [...days].sort().reverse();
  for (const account of accounts) {
    const mine = transactions.filter((t) => t.accountId === account.id).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    let index = 0;
    let after = 0;
    for (const day of descending) {
      while (index < mine.length && mine[index].date > day) after += toCents(mine[index++].amount);
      result.get(day)!.set(account.id, toCents(account.balance) - after);
    }
  }
  return result;
}

/**
 * Ledger part of a row written before `ledgerAmount` existed, estimated from what was known when it was written:
 * a bank account connected by then counted with its balance on that day (the bank reported it), one connected
 * later counted nothing; an import account counted the transactions imported by then, whatever their date.
 */
function legacyLedgerCents(row: StoredCashRow, accounts: LedgerAccount[], imported: Map<string, ImportedSoFar>, perAccount: Map<string, number>): number {
  const writtenAt = row.updatedAt.getTime();
  let cents = 0;
  for (const account of accounts) {
    if (account.createdAt.getTime() > writtenAt) continue;
    cents += account.kind === "auto" ? (perAccount.get(account.id) ?? 0) : importedBy(imported.get(account.id), writtenAt);
  }
  return cents;
}

/** Transactions of an import account in creation order, with running totals in cents. */
interface ImportedSoFar {
  times: number[];
  totals: number[];
}

function importedSoFar(accounts: LedgerAccount[], transactions: LedgerTransaction[]): Map<string, ImportedSoFar> {
  const result = new Map<string, ImportedSoFar>();
  for (const account of accounts.filter((a) => a.kind === "import")) {
    const mine = transactions.filter((t) => t.accountId === account.id).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    let running = 0;
    result.set(account.id, { times: mine.map((t) => t.createdAt.getTime()), totals: mine.map((t) => (running += toCents(t.amount))) });
  }
  return result;
}

/** Sum of the transactions created at or before `time` (binary search on the creation times). */
function importedBy(history: ImportedSoFar | undefined, time: number): number {
  if (!history) return 0;
  let low = 0;
  let high = history.times.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (history.times[mid] <= time) low = mid + 1;
    else high = mid;
  }
  return low === 0 ? 0 : history.totals[low - 1];
}

/** First day of the reconstruction window: first ledger transaction, at most `MAX_DERIVED_HISTORY_MONTHS` back. */
function windowStart(transactions: LedgerTransaction[], today: Date): string | null {
  if (transactions.length === 0) return null;
  const first = transactions.reduce((min, t) => (t.date < min ? t.date : min), transactions[0].date);
  const cutoff = toDateKey(new Date(today.getFullYear(), today.getMonth() - MAX_DERIVED_HISTORY_MONTHS, 1));
  return first < cutoff ? cutoff : first;
}

/**
 * Rows to write so that every past `liquidita` row reflects the current ledger transactions. Rows dated today or
 * later are left alone (today is always live, and the daily snapshot writes it). Returns only rows whose amount or
 * ledger part changes, plus the missing days of the window.
 */
export function planCashHistory({ rows, accounts, transactions, manualNow, today }: CashHistoryInput): CashRowWrite[] {
  const todayStart = startOfDay(today);
  const todayKey = toDateKey(todayStart);
  const past = rows.filter((r) => r.date < todayKey).sort((a, b) => (a.date < b.date ? -1 : 1));
  const known = new Set(past.map((r) => r.date));

  const start = windowStart(
    transactions.filter((t) => t.date < todayKey),
    todayStart
  );
  const missing: string[] = [];
  if (start) {
    for (let cursor = parseDateOnly(start); toDateKey(cursor) < todayKey; cursor = addDays(cursor, 1)) {
      const key = toDateKey(cursor);
      if (!known.has(key)) missing.push(key);
    }
  }

  const ledger = ledgerByDay(accounts, transactions, [...known, ...missing]);
  const totalOn = (day: string) => [...ledger.get(day)!.values()].reduce((sum, v) => sum + v, 0);

  const imported = importedSoFar(accounts, transactions);
  const writes: CashRowWrite[] = [];
  // Manual part of each stored row after the update: carried to the missing days around it.
  const manualByDay = new Map<string, number>();
  for (const row of past) {
    const newLedger = totalOn(row.date);
    const oldLedger = row.ledgerAmount === null ? legacyLedgerCents(row, accounts, imported, ledger.get(row.date)!) : toCents(row.ledgerAmount);
    const manual = toCents(row.amount) - oldLedger;
    manualByDay.set(row.date, manual);
    const amount = manual + newLedger;
    if (row.ledgerAmount === null || amount !== toCents(row.amount) || newLedger !== oldLedger) {
      writes.push({ date: row.date, amount: fromCents(amount), ledgerAmount: fromCents(newLedger), insert: false });
    }
  }

  // Both lists are sorted: `cursor` is the first stored day after the missing one.
  const storedDays = [...manualByDay.keys()];
  let cursor = 0;
  for (const day of missing) {
    while (cursor < storedDays.length && storedDays[cursor] < day) cursor++;
    const previous = storedDays[cursor - 1];
    const next = storedDays[cursor];
    const manual = previous !== undefined ? manualByDay.get(previous)! : next !== undefined ? manualByDay.get(next)! : toCents(manualNow);
    const newLedger = totalOn(day);
    writes.push({ date: day, amount: fromCents(manual + newLedger), ledgerAmount: fromCents(newLedger), insert: true });
  }
  return writes.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Ledger part of today's total: what the daily snapshot stores next to the sum of balances. */
export function ledgerAmountToday(accounts: LedgerAccount[], transactions: LedgerTransaction[], today: Date): number {
  const todayKey = toDateKey(startOfDay(today));
  const cents = accounts.reduce((sum, a) => sum + toCents(a.balance), 0) - transactions.filter((t) => t.date > todayKey).reduce((sum, t) => sum + toCents(t.amount), 0);
  return fromCents(cents);
}
