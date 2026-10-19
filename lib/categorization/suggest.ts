import { isDirectionCompatible } from "./match-rule";
import { jaccardSimilarity, merchantKey, merchantKeyTokens } from "./merchant-key";
import type { CategoryType } from "@/lib/categories/groups";

const SIMILARITY_THRESHOLD = 0.5;

/** From 70% a suggestion applies on its own (if the user left auto-apply on), without going through Categorizza: a wrong category costs one tap, a pile of cards to confirm costs the whole flow (decision 2026-10-19). */
export const AUTO_APPLY_THRESHOLD = 0.7;
/** Una proposta dalle scelte passate è sicura solo se almeno tanti movimenti dello stesso esercente concordano. */
export const MIN_HISTORY_AGREEING = 3;

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
  type: CategoryType;
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
  /** Solo `storico`: movimenti passati simili nella categoria proposta, su quanti simili in tutto. */
  history?: { agreeing: number; total: number };
  /** Solo `regola`: il pattern della regola simile. */
  rulePattern?: string;
}

export interface SuggestionGroup {
  // Identificatore stabile del gruppo, da usare per ogni lookup/keying lato consumatori (Map, chiavi
  // React, corrispondenza fra proposte). Include la direzione oltre alla chiave merchant: due gruppi
  // possono condividere lo stesso `merchantKey` (es. un acquisto e il suo rimborso dallo stesso
  // esercente) mentre restano gruppi distinti a tutti gli effetti.
  groupKey: string;
  merchantKey: string;
  label: string;
  transactionIds: string[];
  // Descrizione grezza di ogni transazione del gruppo, nello stesso ordine di `transactionIds` —
  // usata dalla UI di revisione per l'espansione (le descrizioni possono differire leggermente pur
  // condividendo la stessa chiave merchant, es. suffissi/codici di transazione variabili).
  transactionDescriptions: string[];
  /** Data (AAAA-MM-GG) e importo di ogni transazione, nello stesso ordine di `transactionIds`. */
  transactionDates: string[];
  transactionAmounts: number[];
  totalAmount: number;
  suggestion: CategorizeSuggestion | null;
  hasDivergentSuggestions: boolean;
  /** Indirizzo del logo dell'esercente sul nostro server, aggiunto dalla rotta (null = iniziale). */
  logoPath?: string | null;
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
    rulePattern: best.rule.pattern,
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
  const averageSimilarity = winning.reduce((sum, match) => sum + match.similarity, 0) / winning.length;
  // Sicurezza = quota dei movimenti simili nella categoria vincente × quanto sono simili × quante prove ci sono: con meno
  // di `MIN_HISTORY_AGREEING` movimenti d'accordo resta proporzionalmente più bassa (uno solo non basta a essere sicuri).
  const evidence = Math.min(1, winning.length / MIN_HISTORY_AGREEING);
  const confidence = Math.round((winning.length / matches.length) * averageSimilarity * evidence * 100) / 100;

  return {
    transactionId: transaction.id,
    merchantKey: key,
    suggestedCategoryId: winningCategoryId,
    source: "storico",
    confidence,
    reason: `Come ${winning.length} ${winning.length === 1 ? "transazione passata" : "transazioni passate"}`,
    suggestedSplitPercentage: uniform && percentages[0] > 0 ? percentages[0] : null,
    history: { agreeing: winning.length, total: matches.length },
  };
}

/**
 * Proposte per le transazioni ancora da categorizzare: la somiglianza con una regola esistente e quella con lo storico
 * già categorizzato. Ogni transazione riceve al massimo una proposta: quella della regola se è sicura, altrimenti la
 * migliore fra le due (una proposta sicura dallo storico vince su una regola solo vagamente simile). Non scrive nulla:
 * il livello assistente si innesta a valle, sulle transazioni rimaste senza proposta sicura.
 */
export function computeSuggestions(input: SuggestInput): CategorizeSuggestion[] {
  const suggestions: CategorizeSuggestion[] = [];
  for (const transaction of input.uncategorized) {
    const key = merchantKey(transaction.description);
    const fromRule = suggestFromRules(transaction, key, input);
    const fromHistory = fromRule && isConfidentSuggestion(fromRule) ? null : suggestFromHistory(transaction, key, input);
    const suggestion = fromRule && fromHistory ? betterSuggestion(fromRule, fromHistory) : (fromRule ?? fromHistory);
    if (suggestion) suggestions.push(suggestion);
  }
  return suggestions;
}

const SOURCE_PRIORITY: Record<SuggestionSource, number> = { regola: 3, storico: 2, assistente: 1 };

/**
 * Vero se la proposta è abbastanza sicura da applicarsi da sola: almeno `AUTO_APPLY_THRESHOLD` e, se viene dalle
 * scelte passate, sostenuta da almeno `MIN_HISTORY_AGREEING` movimenti nella stessa categoria.
 */
export function isConfidentSuggestion(suggestion: CategorizeSuggestion): boolean {
  if (suggestion.confidence < AUTO_APPLY_THRESHOLD) return false;
  if (suggestion.source === "storico") return (suggestion.history?.agreeing ?? 0) >= MIN_HISTORY_AGREEING;
  return true;
}

/** La migliore fra due proposte: prima una sicura, poi la sorgente più alta, a pari sorgente la confidenza maggiore. */
function betterSuggestion(winner: CategorizeSuggestion, candidate: CategorizeSuggestion): CategorizeSuggestion {
  const byConfidence = Number(isConfidentSuggestion(candidate)) - Number(isConfidentSuggestion(winner));
  if (byConfidence !== 0) return byConfidence > 0 ? candidate : winner;
  const byPriority = SOURCE_PRIORITY[candidate.source] - SOURCE_PRIORITY[winner.source];
  if (byPriority !== 0) return byPriority > 0 ? candidate : winner;
  return candidate.confidence > winner.confidence ? candidate : winner;
}

/**
 * Transazioni da categorizzare raccolte per chiave merchant **e direzione**, così che una scelta sola ne
 * categorizzi molte senza mai mescolare entrate e uscite dello stesso esercente (es. un acquisto e il suo
 * rimborso): un gruppo con importi di segno misto renderebbe `totalAmount` un pessimo indicatore di
 * direzione per la UI e farebbe rifiutare l'intero batch dal guard di direzione lato server. Il gruppo
 * eredita la proposta migliore fra quelle delle sue transazioni (prima una sicura, poi la sorgente più alta, a pari
 * sorgente la confidenza maggiore) e segnala se al suo interno convivono proposte di categorie diverse. Ordinati per
 * numerosità decrescente: i gruppi che fanno risparmiare più lavoro stanno in cima.
 */
export function groupByMerchant(
  uncategorized: SuggestTransaction[],
  suggestions: CategorizeSuggestion[]
): SuggestionGroup[] {
  const suggestionByTransactionId = new Map(suggestions.map((s) => [s.transactionId, s]));
  const byGroupKey = new Map<string, { merchantKey: string; transactions: SuggestTransaction[] }>();
  for (const transaction of uncategorized) {
    const key = merchantKey(transaction.description);
    const direction = transaction.amount >= 0 ? "entrata" : "uscita";
    const groupKey = `${key}::${direction}`;
    const bucket = byGroupKey.get(groupKey);
    if (bucket) bucket.transactions.push(transaction);
    else byGroupKey.set(groupKey, { merchantKey: key, transactions: [transaction] });
  }

  const groups: SuggestionGroup[] = [];
  for (const [groupKey, { merchantKey: key, transactions: group }] of byGroupKey) {
    const groupSuggestions = group
      .map((transaction) => suggestionByTransactionId.get(transaction.id))
      .filter((suggestion): suggestion is CategorizeSuggestion => suggestion !== undefined);

    const best = groupSuggestions.length === 0 ? null : groupSuggestions.reduce(betterSuggestion);

    const mostRecent = group.reduce((latest, candidate) => (candidate.date > latest.date ? candidate : latest));

    groups.push({
      groupKey,
      merchantKey: key,
      label: mostRecent.description,
      transactionIds: group.map((transaction) => transaction.id),
      transactionDescriptions: group.map((transaction) => transaction.description),
      transactionDates: group.map((transaction) => transaction.date),
      transactionAmounts: group.map((transaction) => transaction.amount),
      totalAmount: Math.round(group.reduce((sum, transaction) => sum + transaction.amount, 0) * 100) / 100,
      suggestion: best,
      hasDivergentSuggestions:
        new Set(groupSuggestions.map((suggestion) => suggestion.suggestedCategoryId)).size > 1,
    });
  }

  return groups.sort((a, b) => b.transactionIds.length - a.transactionIds.length);
}

/** Proposta dell'assistente già salvata per un esercente (chiave `merchantKey::direzione`). */
export interface StoredAssistantSuggestion {
  categoryId: string;
  confidence: number;
}

/**
 * Innesta le proposte dell'assistente sui gruppi: riempiono i gruppi senza proposta e sostituiscono una proposta
 * incerta di regole o storico quando sono loro le sicure.
 */
export function withAssistantSuggestions(
  groups: SuggestionGroup[],
  stored: ReadonlyMap<string, StoredAssistantSuggestion>
): SuggestionGroup[] {
  return groups.map((group) => {
    const row = stored.get(group.groupKey);
    if (!row) return group;
    const assistant: CategorizeSuggestion = {
      transactionId: group.transactionIds[0],
      merchantKey: group.merchantKey,
      suggestedCategoryId: row.categoryId,
      source: "assistente",
      confidence: row.confidence,
      reason: "Proposta dall'assistente",
      suggestedSplitPercentage: null,
    };
    if (!group.suggestion) return { ...group, suggestion: assistant };
    if (!isConfidentSuggestion(group.suggestion) && isConfidentSuggestion(assistant)) return { ...group, suggestion: assistant };
    return group;
  });
}

/** Il gruppo può categorizzarsi da solo: proposta sicura e nessuna proposta diversa fra i suoi movimenti. */
export function isAutoApplicable(group: SuggestionGroup): boolean {
  return group.suggestion !== null && !group.hasDivergentSuggestions && isConfidentSuggestion(group.suggestion);
}
