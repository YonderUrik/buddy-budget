import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";
import { computeCategorizeSuggestions } from "@/lib/calc/categorize-suggestions";

/**
 * GET /api/transactions/categorize-suggestions — per ogni transazione "Da categorizzare" dell'utente
 * con almeno un match storico simile (descrizione già categorizzata in passato, per similarità a
 * token), suggerisce la categoria più frequente e, se coerente, la percentuale di split da
 * riproporre. Nessun filtro periodo: considera l'intero storico dell'utente autenticato.
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

  const uncategorized = allTransactions.filter((transaction) => fallbackIds.has(transaction.categoryId));
  const historical = allTransactions.filter((transaction) => !fallbackIds.has(transaction.categoryId));

  const suggestions = computeCategorizeSuggestions(uncategorized, historical);

  return Response.json(suggestions);
}
