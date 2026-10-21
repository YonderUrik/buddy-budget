/**
 * Paginated, filtered transaction feed (Movimenti): the same filters as the web screen (`filterTransactions`,
 * `filterByTransactionType`, «Da sistemare» = fallback category) plus a keyset cursor. Pure: the database query in
 * `transactions-list.server.ts` only narrows the rows, these functions decide what is in a page.
 */
import { filterByTransactionType, filterTransactions, type TransactionDirection } from "@/lib/calc/expenses";
import type { Transaction } from "@/lib/db/schema/transactions";

/** Largest page a client may ask for. */
export const TRANSACTION_PAGE_MAX = 200;
/** Page size when a client asks for a page (`cursor`) without `limit`. */
export const TRANSACTION_PAGE_DEFAULT = 50;

/** Position after the last row of a page: rows are ordered by date, then id, both descending. */
export interface TransactionCursor {
  date: string;
  id: string;
}

export interface TransactionListFilter {
  direction: TransactionDirection;
  accountId: string | null;
  categoryId: string | null;
  /** Case-insensitive substring of description or note (`filterTransactions`). */
  searchText: string;
  /** Only rows on the fallback category («Da categorizzare»): the «Da sistemare» toggle. */
  uncategorizedOnly: boolean;
}

const CURSOR_PATTERN = /^(\d{4}-\d{2}-\d{2})\|([0-9a-f-]{36})$/i;

/** Opaque cursor string (base64url of `date|id`). */
export function encodeTransactionCursor(cursor: TransactionCursor): string {
  return Buffer.from(`${cursor.date}|${cursor.id}`, "utf8").toString("base64url");
}

/** Cursor from its string, or null when it was not produced by `encodeTransactionCursor`. */
export function decodeTransactionCursor(value: string): TransactionCursor | null {
  const match = CURSOR_PATTERN.exec(Buffer.from(value, "base64url").toString("utf8"));
  return match ? { date: match[1], id: match[2].toLowerCase() } : null;
}

/** Feed order: newest date first, then id descending (stable inside a day). */
export function compareFeedOrder(a: Pick<Transaction, "date" | "id">, b: Pick<Transaction, "date" | "id">): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return a.id === b.id ? 0 : a.id < b.id ? 1 : -1;
}

/** True when `row` comes after `cursor` in feed order. */
export function isAfterCursor(row: Pick<Transaction, "date" | "id">, cursor: TransactionCursor): boolean {
  return compareFeedOrder(row, cursor) > 0;
}

/** The rows the Movimenti screen shows for `filter`, with the web's own filter functions. */
export function applyTransactionListFilter<T extends Transaction>(rows: T[], filter: TransactionListFilter, fallbackCategoryIds: ReadonlySet<string>): T[] {
  const filtered = filterByTransactionType(
    filterTransactions(rows, { categoryId: filter.categoryId, searchText: filter.searchText, accountId: filter.accountId }),
    filter.direction,
  ) as T[];
  return filter.uncategorizedOnly ? filtered.filter((t) => fallbackCategoryIds.has(t.categoryId)) : filtered;
}

/** One page of `rows` (any order) after `cursor`, and the cursor of the next page (null on the last one). */
export function paginateTransactions<T extends Transaction>(rows: T[], limit: number, cursor: TransactionCursor | null): { items: T[]; nextCursor: string | null } {
  const ordered = [...rows].sort(compareFeedOrder).filter((row) => !cursor || isAfterCursor(row, cursor));
  const items = ordered.slice(0, limit);
  const last = items.at(-1);
  return { items, nextCursor: ordered.length > limit && last ? encodeTransactionCursor({ date: last.date, id: last.id }) : null };
}
