import { isAutomaticCategorySource, type AutomaticCategorySource, type CategorySource } from "./category-source";
import { merchantKey } from "./merchant-key";
import {
  computeSuggestions,
  groupByMerchant,
  isAutoApplicable,
  withAssistantSuggestions,
  type StoredAssistantSuggestion,
  type SuggestCategory,
  type SuggestRule,
  type SuggestTransaction,
} from "./suggest";

/**
 * Cosa ricategorizzare: `tutto` (il pulsante in Categorizza, con o senza i movimenti categorizzati prima che se ne
 * segnasse l'origine) oppure i movimenti passati che una sola regola, appena salvata, prenderebbe.
 */
export type RecategorizeScope = { kind: "tutto"; includeLegacy: boolean } | { kind: "regola"; ruleId: string };

/** Movimento già categorizzato, nella forma che serve al piano. */
export interface RecategorizeRow {
  id: string;
  description: string;
  rawDescription: string | null;
  amount: number;
  excludedAmount: number;
  date: string;
  categoryId: string;
  categorySource: CategorySource | null;
}

export interface RecategorizeInput {
  /** I movimenti dell'utente (quelli «Da categorizzare» vengono ignorati: sono il lavoro del giro automatico). */
  rows: readonly RecategorizeRow[];
  categories: readonly SuggestCategory[];
  rules: readonly SuggestRule[];
  /** La regola dell'utente che prende il movimento, se ce n'è una (come negli import). */
  resolveRule: (input: { description: string; amount: number }) => { categoryId: string; ruleId: string } | null;
  /** Proposte dell'assistente già salvate, per chiave `merchantKey::direzione`. */
  storedAssistant: ReadonlyMap<string, StoredAssistantSuggestion>;
  /** Le proposte sicure si applicano da sole: senza, ricategorizzare usa solo le regole. */
  autoApply: boolean;
  assistantConsent: boolean;
  scope: RecategorizeScope;
}

/** Movimenti dello stesso esercente che passerebbero dalla stessa categoria a un'altra, per la stessa ragione. */
export interface RecategorizeGroup {
  key: string;
  merchantKey: string;
  /** Descrizione del movimento più recente. */
  label: string;
  fromCategoryId: string;
  toCategoryId: string;
  source: AutomaticCategorySource;
  /** Sicurezza della proposta (null per le regole). */
  confidence: number | null;
  /** Quota esclusa da ogni importo nella categoria nuova (1 per i trasferimenti). */
  percentage: number;
  ruleId: string | null;
  transactionIds: string[];
  /** Quanti fra questi erano stati categorizzati prima che se ne segnasse l'origine. */
  legacyCount: number;
  firstDate: string;
  lastDate: string;
  totalAmount: number;
}

export interface RecategorizePlan {
  groups: RecategorizeGroup[];
  /** Movimenti che cambierebbero categoria. */
  changes: number;
  /** Di questi, quanti erano stati categorizzati prima che se ne segnasse l'origine. */
  legacyChanges: number;
}

/** Quota esclusa messa a mano con «Dividi» (né zero né tutto l'importo): una scelta dell'utente da non toccare. */
function hasManualSplit(row: RecategorizeRow): boolean {
  const excluded = Math.abs(row.excludedAmount);
  return excluded > 0 && excluded < Math.abs(row.amount);
}

/**
 * Il movimento può essere ricategorizzato: la categoria l'ha messa una regola o una proposta sicura, oppure (se
 * richiesto) è stato categorizzato prima che se ne segnasse l'origine e non è stato diviso a mano. Le scelte dell'utente
 * (`utente`) non si toccano mai.
 */
export function isRecategorizeCandidate(row: RecategorizeRow, includeLegacy: boolean): boolean {
  if (isAutomaticCategorySource(row.categorySource)) return true;
  return includeLegacy && row.categorySource === null && !hasManualSplit(row);
}

function toSuggestTransaction(row: RecategorizeRow): SuggestTransaction {
  return { id: row.id, description: row.description, amount: row.amount, excludedAmount: row.excludedAmount, date: row.date, categoryId: row.categoryId };
}

interface Target {
  row: RecategorizeRow;
  toCategoryId: string;
  source: AutomaticCategorySource;
  confidence: number | null;
  percentage: number;
  ruleId: string | null;
}

/**
 * Cosa deciderebbe oggi BuddyBudget per i movimenti già categorizzati da solo: prima le regole (come negli import),
 * poi, solo per `tutto` e con l'applicazione automatica attiva, le proposte sicure dal 70% ricavate dalle scelte
 * dell'utente (mai dalle categorie messe da sole, che si confermerebbero da sé) e dall'assistente con il consenso.
 * Rows categorised with the bank's own category change only through a rule.
 * Tiene solo i movimenti la cui categoria cambierebbe; quelli senza una proposta sicura restano come sono. Non scrive
 * nulla e non chiama l'assistente.
 */
export function planRecategorize(input: RecategorizeInput): RecategorizePlan {
  const categoryById = new Map(input.categories.map((category) => [category.id, category]));
  const includeLegacy = input.scope.kind === "regola" || input.scope.includeLegacy;
  const ruleById = new Map(input.rules.map((rule) => [rule.id, rule]));

  const candidates: RecategorizeRow[] = [];
  const history: RecategorizeRow[] = [];
  for (const row of input.rows) {
    const category = categoryById.get(row.categoryId);
    if (!category || category.isFallback) continue;
    (isRecategorizeCandidate(row, includeLegacy) ? candidates : history).push(row);
  }

  const targets: Target[] = [];
  const withoutRule: RecategorizeRow[] = [];
  for (const row of candidates) {
    const resolved =
      input.resolveRule({ description: row.description, amount: row.amount }) ??
      (row.rawDescription ? input.resolveRule({ description: row.rawDescription, amount: row.amount }) : null);
    const category = resolved ? categoryById.get(resolved.categoryId) : undefined;
    if (!resolved || !category || category.isFallback) {
      // The bank's own category gives way only to a rule of the user, never to a proposal.
      if (row.categorySource !== "banca") withoutRule.push(row);
      continue;
    }
    if (input.scope.kind === "regola" && resolved.ruleId !== input.scope.ruleId) continue;
    const percentage = category.type === "trasferimento" ? 1 : ruleById.get(resolved.ruleId)?.splitPercentage ?? 0;
    targets.push({ row, toCategoryId: category.id, source: "regola", confidence: null, percentage, ruleId: resolved.ruleId });
  }

  if (input.scope.kind === "tutto" && input.autoApply && withoutRule.length > 0) {
    const pending = withoutRule.map(toSuggestTransaction);
    const suggestions = computeSuggestions({
      uncategorized: pending,
      history: history.map(toSuggestTransaction),
      rules: [...input.rules],
      categories: [...input.categories],
    });
    const rowById = new Map(withoutRule.map((row) => [row.id, row]));
    for (const group of withAssistantSuggestions(groupByMerchant(pending, suggestions), input.storedAssistant)) {
      const suggestion = group.suggestion;
      if (!suggestion || !isAutoApplicable(group)) continue;
      if (suggestion.source === "assistente" && !input.assistantConsent) continue;
      const category = categoryById.get(suggestion.suggestedCategoryId);
      if (!category || category.isFallback) continue;
      const percentage = category.type === "trasferimento" ? 1 : suggestion.suggestedSplitPercentage ?? 0;
      for (const id of group.transactionIds) {
        const row = rowById.get(id);
        if (row) targets.push({ row, toCategoryId: category.id, source: suggestion.source, confidence: suggestion.confidence, percentage, ruleId: null });
      }
    }
  }

  const byKey = new Map<string, RecategorizeGroup>();
  for (const target of targets) {
    const { row } = target;
    if (target.toCategoryId === row.categoryId) continue;
    const key = merchantKey(row.description);
    const direction = row.amount >= 0 ? "entrata" : "uscita";
    const groupKey = [key, direction, row.categoryId, target.toCategoryId, target.source, target.percentage].join("::");
    const legacy = row.categorySource === null ? 1 : 0;
    const group = byKey.get(groupKey);
    if (!group) {
      byKey.set(groupKey, {
        key: groupKey,
        merchantKey: key,
        label: row.description,
        fromCategoryId: row.categoryId,
        toCategoryId: target.toCategoryId,
        source: target.source,
        confidence: target.confidence,
        percentage: target.percentage,
        ruleId: target.ruleId,
        transactionIds: [row.id],
        legacyCount: legacy,
        firstDate: row.date,
        lastDate: row.date,
        totalAmount: row.amount,
      });
      continue;
    }
    group.transactionIds.push(row.id);
    group.legacyCount += legacy;
    if (row.date > group.lastDate) {
      group.lastDate = row.date;
      group.label = row.description;
    }
    if (row.date < group.firstDate) group.firstDate = row.date;
    group.totalAmount += row.amount;
    if (target.confidence !== null && (group.confidence === null || target.confidence < group.confidence)) group.confidence = target.confidence;
  }

  const groups = [...byKey.values()]
    .map((group) => ({ ...group, totalAmount: Math.round(group.totalAmount * 100) / 100 }))
    .sort((a, b) => b.transactionIds.length - a.transactionIds.length || b.lastDate.localeCompare(a.lastDate));
  return {
    groups,
    changes: groups.reduce((sum, group) => sum + group.transactionIds.length, 0),
    legacyChanges: groups.reduce((sum, group) => sum + group.legacyCount, 0),
  };
}

/** Un gruppo dell'anteprima, come lo riceve la pagina (senza gli id dei movimenti). */
export interface RecategorizePreviewGroup {
  key: string;
  label: string;
  fromCategoryId: string;
  toCategoryId: string;
  source: AutomaticCategorySource;
  confidence: number | null;
  count: number;
  legacyCount: number;
  firstDate: string;
  lastDate: string;
  totalAmount: number;
  logoPath: string | null;
}

/** Risposta dell'anteprima di «Ricategorizza». */
export interface RecategorizePreviewResponse {
  groups: RecategorizePreviewGroup[];
  changes: number;
  legacyChanges: number;
  /** Per `tutto` senza i movimenti più vecchi: quanti di quelli cambierebbero includendoli. */
  legacyAvailable: number;
  autoApply: boolean;
  /** L'ultima ricategorizzazione che si può ancora annullare. */
  lastRun: { id: string; changed: number; createdAt: string } | null;
}

/** Esito di «Ricategorizza». */
export interface RecategorizeApplyResponse {
  runId: string | null;
  changed: number;
  groups: number;
}
