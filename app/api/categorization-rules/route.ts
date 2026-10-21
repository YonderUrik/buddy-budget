import { NextRequest } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { categories } from "@/lib/db/schema/categories";
import { categorizationRules } from "@/lib/db/schema/categorization-rules";
import { createRuleSchema } from "@/lib/validation/categorization-rules";
import { applyRulesToUncategorized } from "@/lib/categorization/auto-apply";
import { countPastMatchesSafely } from "@/lib/categorization/recategorize";
import { merchantKey } from "@/lib/categorization/merchant-key";
import { withMerchantLogos } from "@/lib/categorization/merchant-logo/attach";
import { bindRequestUser, requestLogger, withRoute } from "@/lib/observability";
import { localizeCategory } from "@/lib/localization/categories";
import { resolveProfile } from "@/lib/localization/config";

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
 * GET /api/categorization-rules — the user's rules by descending hitCount, each with the name of its category (default
 * names in the user's language).
 */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }
  bindRequestUser(session.user.id);

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
      categoryType: categories.type,
      categoryDefaultKey: categories.defaultKey,
      categoryIsFallback: categories.isFallback,
    })
    .from(categorizationRules)
    .innerJoin(categories, eq(categorizationRules.categoryId, categories.id))
    .where(eq(categorizationRules.userId, session.user.id))
    .orderBy(desc(categorizationRules.hitCount));

  // Logo dell'esercente della regola, come in Categorizza; il tipo di categoria serve solo a dire se è una spesa.
  const expenseIds = new Set<string>();
  const profile = resolveProfile(session.user);
  const rules = rows.map(({ categoryType, categoryDefaultKey, categoryIsFallback, ...rule }) => {
    if (categoryType !== "entrata" && categoryType !== "trasferimento") expenseIds.add(rule.id);
    // Default category names in the user's language (G11), as GET /api/categories.
    const categoryName = localizeCategory({ name: rule.categoryName, defaultKey: categoryDefaultKey, isFallback: categoryIsFallback }, profile).name;
    return { ...rule, categoryName };
  });
  const withLogos = await withMerchantLogos(rules, (rule) => ({ label: rule.pattern, texts: [], isExpense: expenseIds.has(rule.id) }), session.user.id);
  return Response.json(withLogos);
}

/**
 * POST /api/categorization-rules — crea una regola manuale per l'utente autenticato; 404 se la
 * categoria non è propria, 400 se è la categoria di fallback (una regola su di essa resterebbe sempre
 * inutilizzata a runtime, vedi `selectMatchingRule`), 409 se esiste già una regola con lo stesso tipo
 * di match e pattern (il pattern viene normalizzato con `merchantKey` prima di ogni confronto/scrittura,
 * dato che la risoluzione confronta sempre chiavi normalizzate, mai testo grezzo). Con `replaceExisting`
 * (es. «Ricordala» in Movimenti) la regola che c'è già prende la categoria nuova invece del 409.
 * La regola vale subito: si applica ai movimenti ancora «Da categorizzare» e la risposta dice quanti (`applied`), più
 * quanti movimenti già categorizzati da soli prenderebbe (`pastMatches`, per «Applica anche ai passati»).
 */
async function handlePost(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }
  bindRequestUser(session.user.id);

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
      { error: "Non si può creare una regola sulla categoria di fallback" },
      { status: 400 }
    );
  }

  const normalizedPattern = merchantKey(parsed.data.pattern);

  const splitPercentage =
    parsed.data.splitPercentage === undefined || parsed.data.splitPercentage === null
      ? null
      : parsed.data.splitPercentage.toFixed(4);
  const duplicate = await findDuplicateRule(session.user.id, parsed.data.matchType, normalizedPattern);
  if (duplicate && !parsed.data.replaceExisting) {
    return Response.json(
      { error: "Esiste già una regola con questo pattern" },
      { status: 409 }
    );
  }

  const [rule] = duplicate
    ? await db
        .update(categorizationRules)
        .set({ categoryId: parsed.data.categoryId, splitPercentage, updatedAt: new Date() })
        .where(eq(categorizationRules.id, duplicate.id))
        .returning()
    : await db
        .insert(categorizationRules)
        .values({
          userId: session.user.id,
          matchType: parsed.data.matchType,
          pattern: normalizedPattern,
          categoryId: parsed.data.categoryId,
          splitPercentage,
          source: "manuale",
        })
        .returning();

  const log = requestLogger();
  log.info(duplicate ? "categorization.rule.replaced" : "categorization.rule.created", { kind: rule.matchType });
  const applied = await applyRulesToUncategorized(session.user.id, { log });
  const pastMatches = await countPastMatchesSafely(session.user.id, rule.id, log);
  return Response.json({ ...rule, applied, pastMatches }, { status: duplicate ? 200 : 201 });
}

export const GET = withRoute("categorization_rules.list", handleGet);
export const POST = withRoute("categorization_rules.create", handlePost);
