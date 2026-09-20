import { NextRequest } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { categories } from "@/lib/db/schema/categories";
import { categorizationRules } from "@/lib/db/schema/categorization-rules";
import { createRuleSchema } from "@/lib/validation/categorization-rules";
import { merchantKey } from "@/lib/categorization/merchant-key";

/** Recupera una categoria solo se appartiene all'utente indicato, altrimenti null. */
async function getOwnedCategory(userId: string, categoryId: string) {
  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)));
  return category ?? null;
}

/** Regola esistente dello stesso utente con lo stesso tipo di match e pattern, se esiste. */
async function findDuplicateRule(userId: string, matchType: string, pattern: string) {
  const [existing] = await db
    .select()
    .from(categorizationRules)
    .where(
      and(
        eq(categorizationRules.userId, userId),
        eq(categorizationRules.matchType, matchType as "merchant" | "contains"),
        eq(categorizationRules.pattern, pattern)
      )
    );
  return existing ?? null;
}

/**
 * GET /api/categorization-rules — ritorna le regole dell'utente autenticato, ordinate per
 * hitCount decrescente, ciascuna arricchita con il nome della categoria collegata.
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }

  const rows = await db
    .select({
      id: categorizationRules.id,
      userId: categorizationRules.userId,
      matchType: categorizationRules.matchType,
      pattern: categorizationRules.pattern,
      categoryId: categorizationRules.categoryId,
      splitPercentage: categorizationRules.splitPercentage,
      source: categorizationRules.source,
      hitCount: categorizationRules.hitCount,
      lastAppliedAt: categorizationRules.lastAppliedAt,
      createdAt: categorizationRules.createdAt,
      updatedAt: categorizationRules.updatedAt,
      categoryName: categories.name,
    })
    .from(categorizationRules)
    .innerJoin(categories, eq(categorizationRules.categoryId, categories.id))
    .where(eq(categorizationRules.userId, session.user.id))
    .orderBy(desc(categorizationRules.hitCount));

  return Response.json(rows);
}

/**
 * POST /api/categorization-rules — crea una regola manuale per l'utente autenticato; 404 se la
 * categoria non è propria, 400 se è la categoria di fallback (una regola su di essa resterebbe sempre
 * inutilizzata a runtime, vedi `selectMatchingRule`), 409 se esiste già una regola con lo stesso tipo
 * di match e pattern (il pattern viene normalizzato con `merchantKey` prima di ogni confronto/scrittura,
 * dato che la risoluzione confronta sempre chiavi normalizzate, mai testo grezzo).
 */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }

  const body = await request.json();
  const parsed = createRuleSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

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

  const normalizedPattern = merchantKey(parsed.data.pattern);

  const duplicate = await findDuplicateRule(session.user.id, parsed.data.matchType, normalizedPattern);
  if (duplicate) {
    return Response.json(
      { error: "Esiste già una regola con questo pattern" },
      { status: 409 }
    );
  }

  const [rule] = await db
    .insert(categorizationRules)
    .values({
      userId: session.user.id,
      matchType: parsed.data.matchType,
      pattern: normalizedPattern,
      categoryId: parsed.data.categoryId,
      splitPercentage:
        parsed.data.splitPercentage === undefined || parsed.data.splitPercentage === null
          ? null
          : parsed.data.splitPercentage.toFixed(4),
      source: "manuale",
    })
    .returning();

  return Response.json(rule, { status: 201 });
}
