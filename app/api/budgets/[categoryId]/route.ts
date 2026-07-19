import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { budgets } from "@/lib/db/schema/budgets";
import { categories } from "@/lib/db/schema/categories";
import { upsertBudgetSchema } from "@/lib/validation/budgets";

/**
 * Crea o aggiorna (upsert) il budget mensile di una categoria del proprio utente.
 * Il categoryId arriva dall'URL: viene verificato che appartenga all'utente autenticato
 * prima di qualunque scrittura, per evitare un IDOR su una tabella (categories) altrui
 * (404 sia per categoria inesistente sia per categoria di un altro utente).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }

  const { categoryId } = await params;
  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, session.user.id)));
  if (!category) {
    return new Response(null, { status: 404 });
  }

  const body = await request.json();
  const parsed = upsertBudgetSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const [budget] = await db
    .insert(budgets)
    .values({ userId: session.user.id, categoryId, monthlyAmount: parsed.data.monthlyAmount.toFixed(2) })
    .onConflictDoUpdate({
      target: [budgets.userId, budgets.categoryId],
      set: { monthlyAmount: parsed.data.monthlyAmount.toFixed(2), updatedAt: new Date() },
    })
    .returning();

  return Response.json(budget);
}
