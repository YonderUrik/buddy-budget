import { NextRequest } from "next/server";
import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { sessionOrUnauthorized } from "@/lib/account/route-session";
import { AUTO_CATEGORIZED_RECENT_DAYS, groupAutoCategorized } from "@/lib/categorization/auto-review";
import { withMerchantLogos } from "@/lib/categorization/merchant-logo/attach";
import { db } from "@/lib/db/client";
import { AUTOMATIC_CATEGORY_SOURCES, transactions, type AutomaticCategorySource } from "@/lib/db/schema/transactions";
import { withRoute } from "@/lib/observability";

/** Tetto ai movimenti restituiti: dopo un primo import molto grande la lista resta leggibile e la risposta leggera. */
const AUTO_CATEGORIZED_LIMIT = 1000;

/**
 * GET /api/transactions/auto-categorized — transactions categorised on their own (rules, confident suggestions, bank categories) in the
 * last `AUTO_CATEGORIZED_RECENT_DAYS` days, grouped by merchant and category: the «Messe dall'app» history in Categorizza. Nothing here
 * waits for a confirmation; the user only corrects what is wrong.
 */
async function handleGet(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  const userId = session.user.id;

  const since = new Date(Date.now() - AUTO_CATEGORIZED_RECENT_DAYS * 86_400_000);

  const rows = await db
    .select({
      id: transactions.id,
      description: transactions.description,
      rawDescription: transactions.rawDescription,
      amount: transactions.amount,
      date: transactions.date,
      categoryId: transactions.categoryId,
      source: transactions.categorySource,
      confidence: transactions.categoryConfidence,
      categorizedAt: transactions.categorizedAt,
      bankCategory: transactions.bankCategory,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        inArray(transactions.categorySource, [...AUTOMATIC_CATEGORY_SOURCES]),
        gt(transactions.categorizedAt, since)
      )
    )
    .orderBy(desc(transactions.categorizedAt))
    .limit(AUTO_CATEGORIZED_LIMIT);

  const rawById = new Map(rows.map((row) => [row.id, row.rawDescription]));
  const grouped = groupAutoCategorized(
    rows.map((row) => ({
      id: row.id,
      description: row.description,
      amount: Number(row.amount),
      date: row.date,
      categoryId: row.categoryId,
      source: row.source as AutomaticCategorySource,
      confidence: row.confidence === null ? null : Number(row.confidence),
      categorizedAt: (row.categorizedAt ?? since).toISOString(),
      bankCategory: row.bankCategory,
    }))
  );
  const groups = await withMerchantLogos(
    grouped,
    (group) => ({
      label: group.label,
      texts: [...group.transactionDescriptions, ...group.transactionIds.map((id) => rawById.get(id))],
      isExpense: group.totalAmount < 0,
    }),
    userId
  );
  return Response.json({ groups, total: rows.length });
}

export const GET = withRoute("transactions.auto_categorized", handleGet);
