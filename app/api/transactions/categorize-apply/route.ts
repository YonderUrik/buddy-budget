import { NextRequest } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { categories } from "@/lib/db/schema/categories";
import { categorizationRules } from "@/lib/db/schema/categorization-rules";
import { transactions } from "@/lib/db/schema/transactions";
import { isDirectionCompatible } from "@/lib/categorization/match-rule";
import { applyCategorizationSchema } from "@/lib/validation/categorization-rules";

/**
 * POST /api/transactions/categorize-apply — applica in blocco le scelte fatte nella pagina di
 * revisione: aggiorna categoria e quota esclusa di ogni transazione dei gruppi ricevuti e, dove
 * richiesto, crea o aggiorna la regola `appresa` corrispondente. Tutto in un'unica transazione DB:
 * o passa l'intero batch, o non passa nulla.
 */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }

  const userId = session.user.id;
  const body = await request.json();
  const parsed = applyCategorizationSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const requestedCategoryIds = [...new Set(parsed.data.groups.map((group) => group.categoryId))];
  const ownedCategories = await db
    .select()
    .from(categories)
    .where(and(eq(categories.userId, userId), inArray(categories.id, requestedCategoryIds)));
  if (ownedCategories.length !== requestedCategoryIds.length) {
    return new Response(null, { status: 404 });
  }

  const requestedTransactionIds = parsed.data.groups.flatMap((group) => group.transactionIds);
  const ownedTransactions = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, userId), inArray(transactions.id, requestedTransactionIds)));
  if (ownedTransactions.length !== new Set(requestedTransactionIds).size) {
    return new Response(null, { status: 404 });
  }

  const transactionById = new Map(ownedTransactions.map((transaction) => [transaction.id, transaction]));
  const categoryById = new Map(ownedCategories.map((category) => [category.id, category]));

  // Guard di direzione su ogni transazione prima di scrivere: un solo caso incompatibile invalida
  // l'intero batch, invece di lasciare metà lavoro applicato.
  for (const group of parsed.data.groups) {
    const category = categoryById.get(group.categoryId)!;
    for (const transactionId of group.transactionIds) {
      const transaction = transactionById.get(transactionId)!;
      const isIncome = Number(transaction.amount) > 0;
      if (!isDirectionCompatible(category.type, isIncome, category.isFallback)) {
        return Response.json(
          { error: "La categoria scelta non è compatibile con la direzione della transazione" },
          { status: 400 }
        );
      }
    }
  }

  let applied = 0;
  let rulesCreated = 0;

  await db.transaction(async (tx) => {
    for (const group of parsed.data.groups) {
      for (const transactionId of group.transactionIds) {
        const transaction = transactionById.get(transactionId)!;
        const amount = Number(transaction.amount);
        const magnitude = Math.round(Math.abs(amount) * group.excludedPercentage * 100) / 100;
        const excludedAmount = amount >= 0 ? magnitude : -magnitude;

        await tx
          .update(transactions)
          .set({
            categoryId: group.categoryId,
            excludedAmount: excludedAmount.toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(transactions.id, transactionId));
        applied += 1;
      }

      if (!group.createRule) continue;

      const splitPercentage = group.excludedPercentage > 0 ? group.excludedPercentage.toFixed(4) : null;
      const [rule] = await tx
        .insert(categorizationRules)
        .values({
          userId,
          matchType: "merchant",
          pattern: group.merchantKey,
          categoryId: group.categoryId,
          splitPercentage,
          source: "appresa",
        })
        .onConflictDoUpdate({
          target: [categorizationRules.userId, categorizationRules.matchType, categorizationRules.pattern],
          set: { categoryId: group.categoryId, splitPercentage, updatedAt: new Date() },
        })
        .returning({ id: categorizationRules.id, createdAt: categorizationRules.createdAt, updatedAt: categorizationRules.updatedAt });

      // Distinzione fra creazione e aggiornamento: su un insert entrambe le colonne prendono il
      // `now()` della transazione Postgres e coincidono; su un conflitto `updatedAt` riceve il
      // `new Date()` di JS, sempre diverso da `createdAt`. Se questo confronto si rivelasse fragile
      // in test, sostituiscilo con una SELECT preventiva dei pattern già esistenti.
      if (rule && rule.createdAt.getTime() === rule.updatedAt.getTime()) rulesCreated += 1;
    }
  });

  return Response.json({ applied, rulesCreated });
}
