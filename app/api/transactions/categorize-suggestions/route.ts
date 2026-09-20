import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { categories } from "@/lib/db/schema/categories";
import { categorizationRules } from "@/lib/db/schema/categorization-rules";
import { transactions } from "@/lib/db/schema/transactions";
import { computeSuggestions, groupByMerchant, type SuggestTransaction } from "@/lib/categorization/suggest";

/** Transazione del DB nella forma attesa dal motore delle proposte (numeri già convertiti). */
function toSuggestTransaction(row: typeof transactions.$inferSelect): SuggestTransaction {
  return {
    id: row.id,
    description: row.description,
    amount: Number(row.amount),
    excludedAmount: Number(row.excludedAmount),
    date: row.date,
    categoryId: row.categoryId,
  };
}

/**
 * GET /api/transactions/categorize-suggestions — transazioni ancora sulla categoria di fallback,
 * raggruppate per chiave merchant, ciascuna con l'eventuale proposta ricavata dalle regole esistenti o
 * dallo storico già categorizzato. Non interroga mai l'assistente (endpoint `ai` dedicato), quindi la
 * risposta non dipende dalla disponibilità di un modello.
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }

  const userId = session.user.id;

  const userCategories = await db.select().from(categories).where(eq(categories.userId, userId));
  const fallbackIds = new Set(userCategories.filter((category) => category.isFallback).map((c) => c.id));

  const allTransactions = await db.select().from(transactions).where(eq(transactions.userId, userId));
  const uncategorized = allTransactions
    .filter((transaction) => fallbackIds.has(transaction.categoryId))
    .map(toSuggestTransaction);
  const history = allTransactions
    .filter((transaction) => !fallbackIds.has(transaction.categoryId))
    .map(toSuggestTransaction);

  const rules = await db
    .select({
      id: categorizationRules.id,
      pattern: categorizationRules.pattern,
      categoryId: categorizationRules.categoryId,
      splitPercentage: categorizationRules.splitPercentage,
    })
    .from(categorizationRules)
    .where(eq(categorizationRules.userId, userId));

  const suggestions = computeSuggestions({
    uncategorized,
    history,
    rules: rules.map((rule) => ({
      ...rule,
      splitPercentage: rule.splitPercentage === null ? null : Number(rule.splitPercentage),
    })),
    categories: userCategories.map((category) => ({
      id: category.id,
      type: category.type,
      isFallback: category.isFallback,
    })),
  });

  return Response.json({ groups: groupByMerchant(uncategorized, suggestions) });
}
