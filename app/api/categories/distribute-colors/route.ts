import { NextRequest } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { categories } from "@/lib/db/schema/categories";
import { distributeColors } from "@/lib/calc/distribute-colors";

/**
 * POST /api/categories/distribute-colors — riassegna un colore univoco (dal pool di 48)
 * a ogni categoria non-fallback dell'utente, in ordine di creazione; la categoria fallback
 * ("Da categorizzare") non viene mai toccata. Applica tutti gli update in un'unica
 * transazione: se qualcosa fallisce, nessuna categoria viene modificata.
 */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }

  const userCategories = await db
    .select()
    .from(categories)
    .where(and(eq(categories.userId, session.user.id), eq(categories.isFallback, false)))
    .orderBy(asc(categories.createdAt));

  const assignment = distributeColors(userCategories.map((c) => c.id));

  const updated = await db.transaction(async (tx) => {
    const results = [];
    for (const category of userCategories) {
      const [row] = await tx
        .update(categories)
        .set({ color: assignment[category.id] })
        .where(eq(categories.id, category.id))
        .returning();
      results.push(row);
    }
    return results;
  });

  return Response.json(updated);
}
