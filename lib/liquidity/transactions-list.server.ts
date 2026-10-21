import "server-only";
import { and, desc, eq, gt, gte, inArray, lt, lte, or, type SQL } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { categories } from "@/lib/db/schema/categories";
import { transactions, type Transaction } from "@/lib/db/schema/transactions";
import { withMerchantLogos } from "@/lib/categorization/merchant-logo/attach";
import type { TransactionDirection } from "@/lib/calc/expenses";
import { applyTransactionListFilter, paginateTransactions, type TransactionCursor, type TransactionListFilter } from "./transactions-list";

/** A transaction as `GET /api/transactions` lists it: the row plus the merchant logo path (or null). */
export type ListedTransaction = Transaction & { logoPath: string | null };

function directionCondition(direction: TransactionDirection): SQL | undefined {
  return direction === "uscita" ? lt(transactions.amount, "0") : direction === "entrata" ? gt(transactions.amount, "0") : undefined;
}

/** Transactions of a user in a date window and direction, newest first: the rows behind the legacy feed and the views. */
export async function loadTransactionRows(userId: string, window: { from?: string | null; to?: string | null; direction?: TransactionDirection }): Promise<Transaction[]> {
  const direction = directionCondition(window.direction ?? "tutte");
  return db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        ...(window.from ? [gte(transactions.date, window.from)] : []),
        ...(window.to ? [lte(transactions.date, window.to)] : []),
        ...(direction ? [direction] : []),
      ),
    )
    .orderBy(desc(transactions.date));
}

/** Rows with the merchant logo each one shows (as in Categorizza), or null. */
export function withTransactionLogos(rows: Transaction[], userId: string): Promise<ListedTransaction[]> {
  return withMerchantLogos(rows, (row) => ({ label: row.description, texts: [row.rawDescription], isExpense: Number(row.amount) < 0 }), userId);
}

/** Ids of the user's fallback categories («Da categorizzare»). */
export async function loadFallbackCategoryIds(userId: string): Promise<Set<string>> {
  const rows = await db.select({ id: categories.id }).from(categories).where(and(eq(categories.userId, userId), eq(categories.isFallback, true)));
  return new Set(rows.map((row) => row.id));
}

export interface TransactionPageQuery extends TransactionListFilter {
  from: string | null;
  to: string | null;
  limit: number;
  cursor: TransactionCursor | null;
}

/**
 * One page of the Movimenti feed. The query narrows by every filter it can express in SQL (window, direction, account,
 * category, fallback, cursor) and stops at `limit + 1` rows; the text search runs on decrypted rows, so with a search
 * the window is read whole. The page itself is always decided by `applyTransactionListFilter` + `paginateTransactions`.
 */
export async function loadTransactionPage(userId: string, query: TransactionPageQuery): Promise<{ items: ListedTransaction[]; nextCursor: string | null }> {
  const fallbackIds = await loadFallbackCategoryIds(userId);
  if (query.uncategorizedOnly && fallbackIds.size === 0) return { items: [], nextCursor: null };
  const direction = directionCondition(query.direction);
  const searching = query.searchText.trim() !== "";
  const conditions: SQL[] = [eq(transactions.userId, userId)];
  if (query.from) conditions.push(gte(transactions.date, query.from));
  if (query.to) conditions.push(lte(transactions.date, query.to));
  if (direction) conditions.push(direction);
  if (query.accountId) conditions.push(eq(transactions.accountId, query.accountId));
  if (query.categoryId) conditions.push(eq(transactions.categoryId, query.categoryId));
  if (query.uncategorizedOnly) conditions.push(inArray(transactions.categoryId, [...fallbackIds]));
  if (query.cursor) {
    const after = or(lt(transactions.date, query.cursor.date), and(eq(transactions.date, query.cursor.date), lt(transactions.id, query.cursor.id)));
    if (after) conditions.push(after);
  }
  const base = db.select().from(transactions).where(and(...conditions)).orderBy(desc(transactions.date), desc(transactions.id));
  const rows = searching ? await base : await base.limit(query.limit + 1);
  const page = paginateTransactions(applyTransactionListFilter(rows, query, fallbackIds), query.limit, query.cursor);
  return { items: await withTransactionLogos(page.items, userId), nextCursor: page.nextCursor };
}
