import type { BlockReason } from "../privacy-filter";
import { prepareMerchantForModel } from "../privacy-filter";
import { merchantKey } from "../merchant-key";

export interface UncategorizedRow {
  id: string;
  description: string;
  rawDescription: string | null;
  mcc: string | null;
  amount: number;
}

export type SuggestionDirection = "entrata" | "uscita";

export interface MerchantGroup {
  merchantKey: string;
  direction: SuggestionDirection;
  /** Nome pulito da inviare al modello (l'unico testo che esce dal server). */
  sendName: string;
  mcc: string | null;
  /** Se presente il gruppo non va mai inviato (trasferimento o persona). */
  blocked: BlockReason | null;
  transactionIds: string[];
}

/** Direzione nella stessa forma usata dal raggruppamento di Categorizza (`groupByMerchant`). */
export function directionOf(amount: number): SuggestionDirection {
  return amount >= 0 ? "entrata" : "uscita";
}

/**
 * Raggruppa le transazioni da categorizzare per esercente e direzione (stessa chiave di Categorizza), così una
 * sola domanda al modello vale per tutti i movimenti dell'esercente. Il testo da inviare viene dal testo grezzo
 * della banca quando c'è, perché il filtro privacy riconosce meglio i pagamenti con carta.
 */
export function groupForModel(rows: UncategorizedRow[]): MerchantGroup[] {
  const groups = new Map<string, MerchantGroup>();
  for (const row of rows) {
    const key = merchantKey(row.description);
    const direction = directionOf(row.amount);
    const groupKey = `${key}::${direction}`;
    const existing = groups.get(groupKey);
    if (existing) {
      existing.transactionIds.push(row.id);
      existing.mcc ??= row.mcc;
      continue;
    }
    const prepared = prepareMerchantForModel(row.rawDescription ?? row.description);
    groups.set(groupKey, {
      merchantKey: key,
      direction,
      sendName: prepared.name,
      mcc: row.mcc,
      blocked: prepared.blocked,
      transactionIds: [row.id],
    });
  }
  return [...groups.values()];
}

export interface CategorizedExampleRow {
  description: string;
  rawDescription: string | null;
  categoryId: string;
  count: number;
}

export const EXAMPLES_PER_CATEGORY = 2;
export const MAX_EXAMPLES = 40;

/**
 * Esempi dalle scelte passate dell'utente, per insegnare a Jev il suo modo di classificare: i più frequenti, al
 * massimo due per categoria. Gli esercenti che il filtro privacy blocca non diventano mai esempi.
 */
export function pickExamples(
  rows: CategorizedExampleRow[],
  categoryNameById: ReadonlyMap<string, string>
): { name: string; category: string }[] {
  const perCategory = new Map<string, number>();
  const examples: { name: string; category: string }[] = [];
  for (const row of [...rows].sort((a, b) => b.count - a.count)) {
    if (examples.length >= MAX_EXAMPLES) break;
    const category = categoryNameById.get(row.categoryId);
    if (!category) continue;
    const used = perCategory.get(category) ?? 0;
    if (used >= EXAMPLES_PER_CATEGORY) continue;
    const prepared = prepareMerchantForModel(row.rawDescription ?? row.description);
    if (prepared.blocked) continue;
    perCategory.set(category, used + 1);
    examples.push({ name: prepared.name, category });
  }
  return examples;
}

/** Massimo di gruppi esempio passati a `pickExamples` (prima era il `limit` della query raggruppata). */
export const MAX_EXAMPLE_GROUPS = 400;

/**
 * Raggruppa in memoria i movimenti già categorizzati per (descrizione, testo grezzo, categoria) e li ordina per frequenza.
 * Si fa qui e non con un GROUP BY perché descrizioni e testo grezzo possono essere cifrati nel database (IV casuale).
 */
export function countExampleRows(rows: readonly Omit<CategorizedExampleRow, "count">[], limit = MAX_EXAMPLE_GROUPS): CategorizedExampleRow[] {
  const groups = new Map<string, CategorizedExampleRow>();
  for (const row of rows) {
    const key = JSON.stringify([row.description, row.rawDescription ?? null, row.categoryId]);
    const group = groups.get(key);
    if (group) group.count += 1;
    else groups.set(key, { ...row, count: 1 });
  }
  return [...groups.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}
