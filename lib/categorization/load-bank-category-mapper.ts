import "server-only";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";
import { buildBankCategoryMapper, learnFromCorrections, type BankCategoryMapper } from "./bank-category";

type Reader = Pick<typeof db, "select">;

/**
 * The bank category mapper for one user: their categories and what they taught by moving rows that carried a bank
 * label (`categorySource = utente`). Reads only; `reader` lets the importer use its own transaction.
 */
export async function loadBankCategoryMapper(userId: string, reader: Reader = db): Promise<BankCategoryMapper> {
  const [targets, corrections] = await Promise.all([
    reader
      .select({ id: categories.id, name: categories.name, type: categories.type, defaultKey: categories.defaultKey, isFallback: categories.isFallback })
      .from(categories)
      .where(eq(categories.userId, userId)),
    reader
      .select({ bankCategory: transactions.bankCategory, categoryId: transactions.categoryId })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.categorySource, "utente"), isNotNull(transactions.bankCategory))),
  ]);
  return buildBankCategoryMapper(
    targets,
    learnFromCorrections(corrections.flatMap((row) => (row.bankCategory ? [{ bankCategory: row.bankCategory, categoryId: row.categoryId }] : [])))
  );
}
