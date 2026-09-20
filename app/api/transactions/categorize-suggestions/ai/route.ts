import { NextRequest } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";
import { getSuggester } from "@/lib/categorization/llm";
import { isDirectionCompatible } from "@/lib/categorization/match-rule";
import { merchantKey } from "@/lib/categorization/merchant-key";
import { groupByMerchant, type CategorizeSuggestion, type SuggestTransaction } from "@/lib/categorization/suggest";

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
 * POST /api/transactions/categorize-suggestions/ai — proposte per le transazioni indicate ricavate
 * dal livello assistente (Ollama), se un modello è collegato. **Nessun modello collegato è uno stato
 * normale**, non un guasto: risponde comunque 200 con `{ groups: [] }`, mai un errore né un avviso —
 * chi chiama (la UI di revisione) tratta questa risposta esattamente come "nessuna proposta trovata".
 */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }

  const userId = session.user.id;

  const body = (await request.json()) as { transactionIds?: unknown };
  const transactionIds = Array.isArray(body.transactionIds)
    ? body.transactionIds.filter((id): id is string => typeof id === "string")
    : [];

  if (transactionIds.length === 0) {
    return Response.json({ groups: [] });
  }

  const rows = await db
    .select()
    .from(transactions)
    .where(and(inArray(transactions.id, transactionIds), eq(transactions.userId, userId)));

  // Ownership: ogni id richiesto deve corrispondere a una transazione dell'utente, altrimenti 404 —
  // stesso invariante IDOR-safe delle altre route di questo modulo.
  if (rows.length !== transactionIds.length) {
    return new Response(null, { status: 404 });
  }

  const suggester = getSuggester();
  if (!suggester) {
    return Response.json({ groups: [] });
  }

  const userCategories = await db.select().from(categories).where(eq(categories.userId, userId));
  const uncategorized = rows.map(toSuggestTransaction);

  const llmInput = uncategorized.map((transaction, index) => ({
    index,
    description: transaction.description,
    amount: transaction.amount,
  }));

  const llmSuggestions = await suggester.suggest(llmInput, userCategories);

  const categoryByName = new Map(userCategories.map((category) => [category.name, category]));

  const suggestions: CategorizeSuggestion[] = [];
  for (const llmSuggestion of llmSuggestions) {
    const transaction = uncategorized[llmSuggestion.index];
    if (!transaction) continue;

    const category = categoryByName.get(llmSuggestion.categoryName);
    if (!category || category.isFallback) continue;

    const isIncome = transaction.amount > 0;
    if (!isDirectionCompatible(category.type, isIncome, false)) continue;

    suggestions.push({
      transactionId: transaction.id,
      merchantKey: merchantKey(transaction.description),
      suggestedCategoryId: category.id,
      source: "assistente",
      confidence: llmSuggestion.confidence,
      reason: "Suggerito dall'assistente",
      suggestedSplitPercentage: null,
    });
  }

  return Response.json({ groups: groupByMerchant(uncategorized, suggestions) });
}
