import { NextRequest } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { categories } from "@/lib/db/schema/categories";
import { categorizationRules } from "@/lib/db/schema/categorization-rules";
import { updateRuleSchema } from "@/lib/validation/categorization-rules";
import { merchantKey } from "@/lib/categorization/merchant-key";

/** Recupera una regola solo se appartiene all'utente indicato, altrimenti null. */
async function getOwnedRule(userId: string, ruleId: string) {
  const [rule] = await db
    .select()
    .from(categorizationRules)
    .where(and(eq(categorizationRules.id, ruleId), eq(categorizationRules.userId, userId)));
  return rule ?? null;
}

/** Recupera una categoria solo se appartiene all'utente indicato, altrimenti null. */
async function getOwnedCategory(userId: string, categoryId: string) {
  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)));
  return category ?? null;
}

/** Regola diversa da `excludeRuleId` con lo stesso tipo di match e pattern, se esiste. */
async function findDuplicateRule(
  userId: string,
  matchType: string,
  pattern: string,
  excludeRuleId: string
) {
  const [existing] = await db
    .select()
    .from(categorizationRules)
    .where(
      and(
        eq(categorizationRules.userId, userId),
        eq(categorizationRules.matchType, matchType as "merchant" | "contains"),
        eq(categorizationRules.pattern, pattern),
        ne(categorizationRules.id, excludeRuleId)
      )
    );
  return existing ?? null;
}

/**
 * PATCH /api/categorization-rules/[id] — aggiorna una regola del proprio utente; 404 se non
 * propria o se la nuova categoria non è propria, 400 se la nuova categoria è la fallback (stesso
 * guard di POST), 409 se la combinazione tipo/pattern risultante coincide con un'altra regola già
 * esistente. Il pattern viene rinormalizzato con `merchantKey` prima di salvare, come in creazione.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }

  const { id } = await params;
  const rule = await getOwnedRule(session.user.id, id);
  if (!rule) {
    return new Response(null, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateRuleSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  if (parsed.data.categoryId) {
    const category = await getOwnedCategory(session.user.id, parsed.data.categoryId);
    if (!category) {
      return new Response(null, { status: 404 });
    }
    if (category.isFallback) {
      return Response.json(
        { error: "Non è possibile creare una regola sulla categoria di fallback" },
        { status: 400 }
      );
    }
  }

  const nextMatchType = parsed.data.matchType ?? rule.matchType;
  const nextPattern =
    parsed.data.pattern !== undefined ? merchantKey(parsed.data.pattern) : rule.pattern;

  if (parsed.data.matchType || parsed.data.pattern) {
    const duplicate = await findDuplicateRule(session.user.id, nextMatchType, nextPattern, id);
    if (duplicate) {
      return Response.json(
        { error: "Esiste già una regola con questo pattern" },
        { status: 409 }
      );
    }
  }

  const updateValues: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.matchType) updateValues.matchType = parsed.data.matchType;
  if (parsed.data.pattern !== undefined) updateValues.pattern = nextPattern;
  if (parsed.data.categoryId) updateValues.categoryId = parsed.data.categoryId;
  if (parsed.data.splitPercentage !== undefined) {
    updateValues.splitPercentage =
      parsed.data.splitPercentage === null ? null : parsed.data.splitPercentage.toFixed(4);
  }

  const [updated] = await db
    .update(categorizationRules)
    .set(updateValues)
    .where(eq(categorizationRules.id, id))
    .returning();

  return Response.json(updated);
}

/** DELETE /api/categorization-rules/[id] — elimina una regola del proprio utente; 404 se non propria. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }

  const { id } = await params;
  const rule = await getOwnedRule(session.user.id, id);
  if (!rule) {
    return new Response(null, { status: 404 });
  }

  await db.delete(categorizationRules).where(eq(categorizationRules.id, id));

  return new Response(null, { status: 204 });
}
