/**
 * What the detail of one transaction shows beyond its list row: where it came from, the rule that set its category and
 * the other transactions from the same merchant. Pure functions and types only, so client components can import them;
 * the database loader is `load-detail.ts`.
 */

import { merchantKey } from "@/lib/categorization/merchant-key";

/** How many earlier transactions from the same merchant the detail lists. */
export const MERCHANT_RECENT_LIMIT = 5;

/** How far back the merchant summary looks, in days (one year). */
export const MERCHANT_WINDOW_DAYS = 365;

/** Prefix of the external id given to rows imported through a personal (AI-written) import format. */
const PERSONAL_IMPORT_PREFIX = "personal:";

/** Broker statements that also bring cash movements, keyed by the prefix of their external ids. */
const BROKER_PREFIXES: Record<string, string> = { "trade-republic:": "Trade Republic" };

/** Where a transaction came from: synced from a bank, a file import, a broker statement, the sample data or typed by hand. */
export type TransactionOrigin =
  | { kind: "banca"; institution: string | null }
  | { kind: "file"; format: string | null }
  | { kind: "broker"; broker: string }
  | { kind: "esempio" }
  | { kind: "manuale" };

/** The fields of a transaction and its account that decide its origin. */
export interface OriginInput {
  source: "manuale" | "auto";
  externalId: string | null;
  accountIsDemo: boolean;
}

/** Id of the personal import format named in an external id (`personal:<formatId>:<row>`), or null. */
export function personalFormatId(externalId: string | null): string | null {
  if (!externalId?.startsWith(PERSONAL_IMPORT_PREFIX)) return null;
  const id = externalId.slice(PERSONAL_IMPORT_PREFIX.length).split(":")[0];
  return id || null;
}

/**
 * Origin of a transaction from its data source and external id. Bank names and import format names are looked up by
 * the caller and passed in; without them the origin is still known, only unnamed.
 */
export function transactionOrigin(input: OriginInput, names: { institution?: string | null; format?: string | null } = {}): TransactionOrigin {
  if (input.accountIsDemo) return { kind: "esempio" };
  if (input.source === "auto") return { kind: "banca", institution: names.institution ?? null };
  const externalId = input.externalId;
  if (externalId) {
    const broker = Object.entries(BROKER_PREFIXES).find(([prefix]) => externalId.startsWith(prefix));
    if (broker) return { kind: "broker", broker: broker[1] };
    return { kind: "file", format: names.format ?? null };
  }
  return { kind: "manuale" };
}

/** One earlier transaction from the same merchant, as the detail lists it. */
export interface MerchantMovement {
  id: string;
  date: string;
  /** Signed amount that counts (full amount minus the excluded part). */
  amount: number;
}

/** The same merchant over the last year: how many transactions, how much in total and the most recent others. */
export interface MerchantSummary {
  count: number;
  /** Sum of the counted amounts, signed (negative for spending). */
  total: number;
  recent: MerchantMovement[];
}

/** A transaction row as the merchant summary needs it. */
export interface MerchantCandidate {
  id: string;
  date: string;
  description: string;
  amount: string | number;
  excludedAmount: string | number;
}

/**
 * Transactions from the same merchant (same `merchantKey`) and direction as `current`, among `rows`. Counts the
 * current one too; `recent` lists only the others, newest first. Null when the merchant appears only once or its key
 * is empty: a summary of one transaction says nothing.
 */
export function summarizeMerchant(current: MerchantCandidate, rows: readonly MerchantCandidate[], limit = MERCHANT_RECENT_LIMIT): MerchantSummary | null {
  const key = merchantKey(current.description);
  if (!key) return null;
  const isIncome = Number(current.amount) > 0;
  const same = rows.filter((row) => (Number(row.amount) > 0) === isIncome && merchantKey(row.description) === key);
  if (!same.some((row) => row.id === current.id)) same.push(current);
  if (same.length < 2) return null;
  const counted = (row: MerchantCandidate) => Number(row.amount) - Number(row.excludedAmount);
  const total = Math.round(same.reduce((sum, row) => sum + counted(row), 0) * 100) / 100;
  const recent = same
    .filter((row) => row.id !== current.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)
    .map((row) => ({ id: row.id, date: row.date, amount: counted(row) }));
  return { count: same.length, total, recent };
}

/** First day (YYYY-MM-DD) of the merchant summary window ending on `today`. */
export function merchantWindowStart(today: Date, days = MERCHANT_WINDOW_DAYS): string {
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - days));
  return start.toISOString().slice(0, 10);
}

/** The rule that sorted a transaction, as the detail names it. */
export interface DetailRule {
  id: string;
  matchType: "merchant" | "contains";
  pattern: string;
}

/** Everything the transaction detail shows, as `GET /api/transactions/[id]` returns it. */
export interface TransactionDetailData<T> {
  transaction: T;
  account: { id: string; name: string } | null;
  origin: TransactionOrigin;
  /** The rule that set the category, when it was a rule and that rule still points to the same category. */
  rule: DetailRule | null;
  merchant: MerchantSummary | null;
}

