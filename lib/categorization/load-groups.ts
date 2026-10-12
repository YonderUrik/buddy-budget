import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { categories, type Category } from "@/lib/db/schema/categories";
import { categorizationRules } from "@/lib/db/schema/categorization-rules";
import { categorizationSuggestions } from "@/lib/db/schema/categorization-suggestions";
import { transactions, type Transaction } from "@/lib/db/schema/transactions";
import {
  computeSuggestions,
  groupByMerchant,
  isAutoApplicable,
  withAssistantSuggestions,
  type StoredAssistantSuggestion,
  type SuggestionGroup,
  type SuggestTransaction,
} from "./suggest";

/** Transazione del DB nella forma attesa dal motore delle proposte (numeri già convertiti). */
export function toSuggestTransaction(row: Transaction): SuggestTransaction {
  return {
    id: row.id,
    description: row.description,
    amount: Number(row.amount),
    excludedAmount: Number(row.excludedAmount),
    date: row.date,
    categoryId: row.categoryId,
  };
}

export interface CategorizationState {
  groups: SuggestionGroup[];
  categories: Category[];
  /** Movimenti ancora sulla categoria di ripiego, per id. */
  uncategorized: Map<string, Transaction>;
  /** Le proposte sicure si applicano da sole (preferenza dell'utente). */
  autoApply: boolean;
  /** L'utente ha acconsentito all'assistente: senza consenso le sue proposte salvate non si applicano da sole. */
  assistantConsent: boolean;
}

/**
 * Stato della categorizzazione di un utente: movimenti da categorizzare raggruppati per esercente, ciascun gruppo con
 * la proposta migliore fra regole simili, scelte passate e assistente. Sola lettura: la usano sia la pagina
 * Categorizza sia l'applicazione automatica delle proposte sicure, così le due vedono le stesse proposte.
 */
export async function loadCategorizationState(userId: string): Promise<CategorizationState> {
  const [user] = await db
    .select({ autoApply: authUser.categorizationAutoApply, consentAt: authUser.aiCategorizationConsentAt })
    .from(authUser)
    .where(eq(authUser.id, userId));
  const userCategories = await db.select().from(categories).where(eq(categories.userId, userId));
  const fallbackIds = new Set(userCategories.filter((category) => category.isFallback).map((category) => category.id));

  const allTransactions = await db.select().from(transactions).where(eq(transactions.userId, userId));
  const uncategorizedRows = allTransactions.filter((transaction) => fallbackIds.has(transaction.categoryId));
  const uncategorized = uncategorizedRows.map(toSuggestTransaction);
  const history = allTransactions.filter((transaction) => !fallbackIds.has(transaction.categoryId)).map(toSuggestTransaction);

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
    rules: rules.map((rule) => ({ ...rule, splitPercentage: rule.splitPercentage === null ? null : Number(rule.splitPercentage) })),
    categories: userCategories.map((category) => ({ id: category.id, type: category.type, isFallback: category.isFallback })),
  });

  // Proposte dell'assistente già calcolate: riempiono i gruppi scoperti o sostituiscono una proposta incerta.
  const stored = await db
    .select()
    .from(categorizationSuggestions)
    .where(and(eq(categorizationSuggestions.userId, userId), eq(categorizationSuggestions.status, "in_attesa")));
  const storedByKey = new Map<string, StoredAssistantSuggestion>(
    stored.map((row) => [`${row.merchantKey}::${row.direction}`, { categoryId: row.categoryId, confidence: Number(row.confidence) }])
  );

  return {
    groups: withAssistantSuggestions(groupByMerchant(uncategorized, suggestions), storedByKey),
    categories: userCategories,
    uncategorized: new Map(uncategorizedRows.map((row) => [row.id, row])),
    autoApply: user?.autoApply ?? false,
    assistantConsent: Boolean(user?.consentAt),
  };
}

/**
 * Gruppi che si applicano da soli adesso: solo con la preferenza attiva, con una proposta sicura e, se la proposta
 * viene dall'assistente, con il consenso ancora attivo (le proposte salvate prima di una revoca restano da confermare).
 */
export function autoApplicableGroups(state: Pick<CategorizationState, "groups" | "autoApply" | "assistantConsent">): SuggestionGroup[] {
  if (!state.autoApply) return [];
  return state.groups.filter((group) => isAutoApplicable(group) && (group.suggestion?.source !== "assistente" || state.assistantConsent));
}
