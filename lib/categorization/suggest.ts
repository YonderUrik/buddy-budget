import { isDirectionCompatible } from "./match-rule";
import { jaccardSimilarity, merchantKey, merchantKeyTokens } from "./merchant-key";

const SIMILARITY_THRESHOLD = 0.5;

export type SuggestionSource = "regola" | "storico" | "assistente";

export interface SuggestTransaction {
  id: string;
  description: string;
  amount: number;
  excludedAmount: number;
  date: string;
  categoryId: string;
}

export interface SuggestCategory {
  id: string;
  type: "fissa" | "variabile" | "entrata";
  isFallback: boolean;
}

export interface SuggestRule {
  id: string;
  pattern: string;
  categoryId: string;
  splitPercentage: number | null;
}

export interface SuggestInput {
  uncategorized: SuggestTransaction[];
  rules: SuggestRule[];
  history: SuggestTransaction[];
  categories: SuggestCategory[];
}

export interface CategorizeSuggestion {
  transactionId: string;
  merchantKey: string;
  suggestedCategoryId: string;
  source: SuggestionSource;
  confidence: number;
  reason: string;
  suggestedSplitPercentage: number | null;
}

export interface SuggestionGroup {
  merchantKey: string;
  label: string;
  transactionIds: string[];
  // Descrizione grezza di ogni transazione del gruppo, nello stesso ordine di `transactionIds` —
  // usata dalla UI di revisione per l'espansione (le descrizioni possono differire leggermente pur
  // condividendo la stessa chiave merchant, es. suffissi/codici di transazione variabili).
  transactionDescriptions: string[];
  totalAmount: number;
  suggestion: CategorizeSuggestion | null;
  hasDivergentSuggestions: boolean;
}

/** Quota esclusa come frazione dell'importo, arrotondata per confronti fra importi diversi. */
function splitPercentageOf(transaction: SuggestTransaction): number {
  const amount = Math.abs(transaction.amount);
  if (amount === 0) return 0;
  return Math.round((Math.abs(transaction.excludedAmount) / amount) * 10000) / 10000;
}

/** Una categoria è proponibile solo se esiste, non è la fallback e ha la direzione giusta. */
function canSuggest(categoryId: string, isIncome: boolean, categories: SuggestCategory[]): boolean {
  const category = categories.find((c) => c.id === categoryId);
  if (!category || category.isFallback) return false;
  return isDirectionCompatible(category.type, isIncome, false);
}

/** Proposta ricavata dalla regola più simile alla chiave della transazione, se sopra soglia. */
function suggestFromRules(
  transaction: SuggestTransaction,
  key: string,
  input: SuggestInput
): CategorizeSuggestion | null {
  const isIncome = transaction.amount > 0;
  const keyTokens = merchantKeyTokens(key);

  let best: { rule: SuggestRule; similarity: number } | null = null;
  for (const rule of input.rules) {
    if (!canSuggest(rule.categoryId, isIncome, input.categories)) continue;
    const similarity = jaccardSimilarity(keyTokens, merchantKeyTokens(rule.pattern));
    if (similarity < SIMILARITY_THRESHOLD) continue;
    if (!best || similarity > best.similarity) best = { rule, similarity };
  }
  if (!best) return null;

  return {
    transactionId: transaction.id,
    merchantKey: key,
    suggestedCategoryId: best.rule.categoryId,
    source: "regola",
    confidence: Math.round(best.similarity * 100) / 100,
    reason: `Simile alla regola "${best.rule.pattern}"`,
    suggestedSplitPercentage: best.rule.splitPercentage,
  };
}

/** Proposta ricavata dalle transazioni passate con chiave merchant simile. */
function suggestFromHistory(
  transaction: SuggestTransaction,
  key: string,
  input: SuggestInput
): CategorizeSuggestion | null {
  const isIncome = transaction.amount > 0;
  const keyTokens = merchantKeyTokens(key);

  const matches: { transaction: SuggestTransaction; similarity: number }[] = [];
  for (const candidate of input.history) {
    if (!canSuggest(candidate.categoryId, isIncome, input.categories)) continue;
    const similarity = jaccardSimilarity(keyTokens, merchantKeyTokens(merchantKey(candidate.description)));
    if (similarity >= SIMILARITY_THRESHOLD) matches.push({ transaction: candidate, similarity });
  }
  if (matches.length === 0) return null;

  const countByCategory = new Map<string, number>();
  const latestDateByCategory = new Map<string, string>();
  for (const match of matches) {
    const categoryId = match.transaction.categoryId;
    countByCategory.set(categoryId, (countByCategory.get(categoryId) ?? 0) + 1);
    const latest = latestDateByCategory.get(categoryId);
    if (!latest || match.transaction.date > latest) latestDateByCategory.set(categoryId, match.transaction.date);
  }

  let winningCategoryId = "";
  let winningCount = -1;
  let winningDate = "";
  for (const [categoryId, count] of countByCategory) {
    const latest = latestDateByCategory.get(categoryId) ?? "";
    if (count > winningCount || (count === winningCount && latest > winningDate)) {
      winningCategoryId = categoryId;
      winningCount = count;
      winningDate = latest;
    }
  }

  const winning = matches.filter((match) => match.transaction.categoryId === winningCategoryId);
  const percentages = winning.map((match) => splitPercentageOf(match.transaction));
  const uniform = percentages.every((percentage) => percentage === percentages[0]);
  const averageSimilarity =
    Math.round((winning.reduce((sum, match) => sum + match.similarity, 0) / winning.length) * 100) / 100;

  return {
    transactionId: transaction.id,
    merchantKey: key,
    suggestedCategoryId: winningCategoryId,
    source: "storico",
    confidence: averageSimilarity,
    reason: `Come ${winning.length} ${winning.length === 1 ? "transazione passata" : "transazioni passate"}`,
    suggestedSplitPercentage: uniform && percentages[0] > 0 ? percentages[0] : null,
  };
}

/**
 * Proposte per le transazioni ancora da categorizzare, in cascata: prima la somiglianza con una regola
 * esistente, poi quella con lo storico già categorizzato. Ogni transazione riceve al massimo una
 * proposta, dalla prima sorgente che ne produce una. Non scrive nulla: il livello assistente si innesta
 * a valle, sulle transazioni rimaste senza proposta.
 */
export function computeSuggestions(input: SuggestInput): CategorizeSuggestion[] {
  const suggestions: CategorizeSuggestion[] = [];
  for (const transaction of input.uncategorized) {
    const key = merchantKey(transaction.description);
    const suggestion =
      suggestFromRules(transaction, key, input) ?? suggestFromHistory(transaction, key, input);
    if (suggestion) suggestions.push(suggestion);
  }
  return suggestions;
}

const SOURCE_PRIORITY: Record<SuggestionSource, number> = { regola: 3, storico: 2, assistente: 1 };

/**
 * Transazioni da categorizzare raccolte per chiave merchant, così che una scelta sola ne categorizzi
 * molte. Il gruppo eredita la proposta di sorgente più alta fra quelle delle sue transazioni (a pari
 * sorgente, la confidenza maggiore) e segnala se al suo interno convivono proposte di categorie diverse.
 * Ordinati per numerosità decrescente: i gruppi che fanno risparmiare più lavoro stanno in cima.
 */
export function groupByMerchant(
  uncategorized: SuggestTransaction[],
  suggestions: CategorizeSuggestion[]
): SuggestionGroup[] {
  const suggestionByTransactionId = new Map(suggestions.map((s) => [s.transactionId, s]));
  const byKey = new Map<string, SuggestTransaction[]>();
  for (const transaction of uncategorized) {
    const key = merchantKey(transaction.description);
    const bucket = byKey.get(key);
    if (bucket) bucket.push(transaction);
    else byKey.set(key, [transaction]);
  }

  const groups: SuggestionGroup[] = [];
  for (const [key, group] of byKey) {
    const groupSuggestions = group
      .map((transaction) => suggestionByTransactionId.get(transaction.id))
      .filter((suggestion): suggestion is CategorizeSuggestion => suggestion !== undefined);

    const best =
      groupSuggestions.length === 0
        ? null
        : groupSuggestions.reduce((winner, candidate) => {
            const byPriority = SOURCE_PRIORITY[candidate.source] - SOURCE_PRIORITY[winner.source];
            if (byPriority !== 0) return byPriority > 0 ? candidate : winner;
            return candidate.confidence > winner.confidence ? candidate : winner;
          });

    const mostRecent = group.reduce((latest, candidate) => (candidate.date > latest.date ? candidate : latest));

    groups.push({
      merchantKey: key,
      label: mostRecent.description,
      transactionIds: group.map((transaction) => transaction.id),
      transactionDescriptions: group.map((transaction) => transaction.description),
      totalAmount: Math.round(group.reduce((sum, transaction) => sum + transaction.amount, 0) * 100) / 100,
      suggestion: best,
      hasDivergentSuggestions:
        new Set(groupSuggestions.map((suggestion) => suggestion.suggestedCategoryId)).size > 1,
    });
  }

  return groups.sort((a, b) => b.transactionIds.length - a.transactionIds.length);
}
