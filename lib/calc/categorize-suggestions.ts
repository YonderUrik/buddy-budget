import type { Transaction } from "@/lib/db/schema/transactions";

export interface CategorizeSuggestion {
  transaction: Transaction;
  suggestedCategoryId: string;
  matchCount: number;
  suggestedSplitPercentage: number | null;
}

function normalizeDescription(description: string): string {
  return description.trim().toLowerCase();
}

/** Percentuale di importo esclusa dal conteggio ("Dividi"), arrotondata per confronti di coerenza tra transazioni diverse. */
function splitPercentage(transaction: Transaction): number {
  const amount = Math.abs(Number(transaction.amount));
  const excluded = Math.abs(Number(transaction.excludedAmount));
  if (amount === 0) return 0;
  return Math.round((excluded / amount) * 10000) / 10000;
}

/**
 * Per ogni transazione "Da categorizzare" con almeno un match storico (stessa descrizione, esatta
 * case-insensitive), suggerisce la categoria più frequente tra i match (pareggio → la più recente) e,
 * se lo split storico della categoria vincente è coerente, la percentuale da riproporre.
 */
export function computeCategorizeSuggestions(
  uncategorized: Transaction[],
  historical: Transaction[]
): CategorizeSuggestion[] {
  const groups = new Map<string, Transaction[]>();
  for (const transaction of historical) {
    const key = normalizeDescription(transaction.description);
    const group = groups.get(key);
    if (group) {
      group.push(transaction);
    } else {
      groups.set(key, [transaction]);
    }
  }

  const suggestions: CategorizeSuggestion[] = [];

  for (const transaction of uncategorized) {
    const group = groups.get(normalizeDescription(transaction.description));
    if (!group || group.length === 0) continue;

    const countByCategory = new Map<string, number>();
    const mostRecentDateByCategory = new Map<string, string>();
    for (const match of group) {
      countByCategory.set(match.categoryId, (countByCategory.get(match.categoryId) ?? 0) + 1);
      const currentMostRecent = mostRecentDateByCategory.get(match.categoryId);
      if (!currentMostRecent || match.date > currentMostRecent) {
        mostRecentDateByCategory.set(match.categoryId, match.date);
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

    const winningMatches = group.filter((match) => match.categoryId === winningCategoryId);
    const percentages = winningMatches.map(splitPercentage);
    const allSame = percentages.every((percentage) => percentage === percentages[0]);

    suggestions.push({
      transaction,
      suggestedCategoryId: winningCategoryId,
      matchCount: winningMatches.length,
      suggestedSplitPercentage: allSame ? percentages[0] : null,
    });
  }

  return suggestions;
}
