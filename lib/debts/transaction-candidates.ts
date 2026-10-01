import type { Transaction } from "@/lib/db/schema/transactions";
import { filterTransactions } from "@/lib/calc/expenses";

/** Filtri del selettore della transazione collegata a una rata. */
export interface CandidateFilter {
  categoryId: string | null;
  searchText: string;
}

export type CandidateFilterUsage = "nessuno" | "testo" | "categoria" | "entrambi";

const MS_PER_DAY = 86_400_000;

function dayDistance(a: string, b: string): number {
  return Math.abs(Date.parse(a) - Date.parse(b)) / MS_PER_DAY;
}

/**
 * Filtra le uscite per testo/categoria e le ordina per vicinanza alla rata: prima chi ha l'importo uguale a quello atteso
 * (entro un centesimo), poi per giorni di distanza dalla scadenza. L'ordine è stabile a parità di punteggio.
 */
export function rankInstallmentCandidates(
  transactions: Transaction[],
  filter: CandidateFilter,
  dueDate: string,
  expectedAmount: number
): Transaction[] {
  const isExact = (t: Transaction) => Math.abs(Math.abs(Number(t.amount)) - expectedAmount) < 0.01;
  return filterTransactions(transactions, filter)
    .map((t, index) => ({ t, index }))
    .sort(
      (a, b) =>
        Number(isExact(b.t)) - Number(isExact(a.t)) ||
        dayDistance(a.t.date, dueDate) - dayDistance(b.t.date, dueDate) ||
        a.index - b.index
    )
    .map(({ t }) => t);
}

/** Quali filtri erano attivi quando l'utente ha scelto una transazione (per l'evento di prodotto). */
export function describeFilterUsage(filter: CandidateFilter): CandidateFilterUsage {
  const text = filter.searchText.trim() !== "";
  const category = filter.categoryId !== null;
  if (text && category) return "entrambi";
  if (text) return "testo";
  if (category) return "categoria";
  return "nessuno";
}
