import { NextRequest } from "next/server";
import { and, count, eq, gte } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { transactions } from "@/lib/db/schema/transactions";
import { CATEGORY_USAGE_WINDOW_DAYS, type CategoryUsageCounts } from "@/lib/categories/picker";
import { bindRequestUser, withRoute } from "@/lib/observability";

/** Data (YYYY-MM-DD) di `days` giorni fa rispetto a `now`. */
function daysAgo(now: Date, days: number): string {
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - days);
  return from.toISOString().slice(0, 10);
}

/**
 * GET /api/categories/usage — numero di transazioni per categoria dell'utente autenticato negli ultimi
 * CATEGORY_USAGE_WINDOW_DAYS giorni, come `{ [categoryId]: count }`. Serve al selettore categorie per
 * mettere in cima le più usate; le categorie mai usate nella finestra sono assenti.
 */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }
  bindRequestUser(session.user.id);

  const rows = await db
    .select({ categoryId: transactions.categoryId, count: count() })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, session.user.id),
        gte(transactions.date, daysAgo(new Date(), CATEGORY_USAGE_WINDOW_DAYS))
      )
    )
    .groupBy(transactions.categoryId);

  const usage: CategoryUsageCounts = Object.fromEntries(rows.map((row) => [row.categoryId, row.count]));
  return Response.json(usage);
}

export const GET = withRoute("categories.usage", handleGet);
