import type { Transaction } from "@/lib/db/schema/transactions";

export interface CategorizeSuggestion {
  transaction: Transaction;
  suggestedCategoryId: string;
  matchCount: number;
  suggestedSplitPercentage: number | null;
  averageSimilarity: number;
}

const SIMILARITY_THRESHOLD = 0.5;

function normalizeDescription(description: string): string {
  return description.trim().toLowerCase();
}

/** Insieme di parole significative di una descrizione: normalizzata, spezzata su spazi/punteggiatura, scartati i token puramente numerici (codici transazione, numeri civici, riferimenti). */
function tokenize(description: string): Set<string> {
  const tokens = normalizeDescription(description)
    .split(/[^a-z0-9à-ÿ]+/)
    .filter((token) => token.length > 0 && !/^\d+$/.test(token));
  return new Set(tokens);
}

/** Indice di Jaccard tra due insiemi di token: |intersezione| / |unione|. */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  let intersectionSize = 0;
  for (const token of a) {
    if (b.has(token)) intersectionSize += 1;
  }
  const unionSize = a.size + b.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

/**
 * Somiglianza tra due descrizioni: Jaccard sui token normalizzati (numeri scartati). Se una delle due
 * non ha token significativi (descrizione interamente numerica), ricade sull'uguaglianza esatta della
 * stringa normalizzata invece di confrontare insiemi vuoti.
 */
function descriptionSimilarity(a: string, b: string): number {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (tokensA.size === 0 || tokensB.size === 0) {
    return normalizeDescription(a) === normalizeDescription(b) ? 1 : 0;
  }
  return jaccardSimilarity(tokensA, tokensB);
}

/** Percentuale di importo esclusa dal conteggio ("Dividi"), arrotondata per confronti di coerenza tra transazioni diverse. */
function splitPercentage(transaction: Transaction): number {
  const amount = Math.abs(Number(transaction.amount));
  const excluded = Math.abs(Number(transaction.excludedAmount));
  if (amount === 0) return 0;
  return Math.round((excluded / amount) * 10000) / 10000;
}

/**
 * Per ogni transazione "Da categorizzare" con almeno un match storico simile (Jaccard sui token di
 * descrizione, numeri scartati, soglia 0.5), suggerisce la categoria più frequente tra i match
 * (pareggio → la più recente) e, se lo split storico della categoria vincente è coerente, la
 * percentuale da riproporre, insieme alla somiglianza media dei match vincenti.
 */
export function computeCategorizeSuggestions(
  uncategorized: Transaction[],
  historical: Transaction[]
): CategorizeSuggestion[] {
  const suggestions: CategorizeSuggestion[] = [];

  for (const transaction of uncategorized) {
    const matches: { transaction: Transaction; similarity: number }[] = [];
    for (const candidate of historical) {
      const similarity = descriptionSimilarity(transaction.description, candidate.description);
      if (similarity >= SIMILARITY_THRESHOLD) {
        matches.push({ transaction: candidate, similarity });
      }
    }
    if (matches.length === 0) continue;

    const countByCategory = new Map<string, number>();
    const mostRecentDateByCategory = new Map<string, string>();
    for (const match of matches) {
      const categoryId = match.transaction.categoryId;
      countByCategory.set(categoryId, (countByCategory.get(categoryId) ?? 0) + 1);
      const currentMostRecent = mostRecentDateByCategory.get(categoryId);
      if (!currentMostRecent || match.transaction.date > currentMostRecent) {
        mostRecentDateByCategory.set(categoryId, match.transaction.date);
      }
    }

    let winningCategoryId = "";
    let winningCount = -1;
    let winningMostRecentDate = "";
    for (const [categoryId, count] of countByCategory) {
      const mostRecentDate = mostRecentDateByCategory.get(categoryId) ?? "";
      const isBetter =
        count > winningCount || (count === winningCount && mostRecentDate > winningMostRecentDate);
      if (isBetter) {
        winningCategoryId = categoryId;
        winningCount = count;
        winningMostRecentDate = mostRecentDate;
      }
    }

    const winningMatches = matches.filter((match) => match.transaction.categoryId === winningCategoryId);
    const percentages = winningMatches.map((match) => splitPercentage(match.transaction));
    const allSame = percentages.every((percentage) => percentage === percentages[0]);
    const averageSimilarity =
      Math.round(
        (winningMatches.reduce((sum, match) => sum + match.similarity, 0) / winningMatches.length) * 100
      ) / 100;

    suggestions.push({
      transaction,
      suggestedCategoryId: winningCategoryId,
      matchCount: winningMatches.length,
      suggestedSplitPercentage: allSame ? percentages[0] : null,
      averageSimilarity,
    });
  }

  return suggestions;
}
