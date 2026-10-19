import { NextRequest } from "next/server";
import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { sessionOrUnauthorized } from "@/lib/account/route-session";
import { groupAutoCategorized } from "@/lib/categorization/auto-review";
import { withMerchantLogos } from "@/lib/categorization/merchant-logo/attach";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { AUTOMATIC_CATEGORY_SOURCES, transactions, type AutomaticCategorySource } from "@/lib/db/schema/transactions";
import { withRoute } from "@/lib/observability";

/** Tetto ai movimenti restituiti: dopo un primo import molto grande la lista resta leggibile e la risposta leggera. */
const AUTO_CATEGORIZED_LIMIT = 1000;

/**
 * GET /api/transactions/auto-categorized — movimenti categorizzati da soli (regole, proposte sicure e categorie della banca) che l'utente non ha
 * ancora controllato, raggruppati per esercente e categoria: la sezione «Messe dall'app» di Categorizza.
 */
async function handleGet(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  const userId = session.user.id;

  const [user] = await db.select({ seenAt: authUser.autoCategorizedSeenAt }).from(authUser).where(eq(authUser.id, userId));
  if (!user) return new Response(null, { status: 404 });

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
        gt(transactions.categorizedAt, user.seenAt)
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
      categorizedAt: (row.categorizedAt ?? user.seenAt).toISOString(),
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
  return Response.json({ groups, total: rows.length, seenAt: user.seenAt.toISOString() });
}

export const GET = withRoute("transactions.auto_categorized", handleGet);
