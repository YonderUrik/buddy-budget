import type { CategorizeSuggestion, SuggestionGroup } from "@/lib/categorization/suggest";

/** Quante righe mostra la card: le altre restano dietro "Categorizza tutte". */
export const ATTENTION_CARD_MAX_ROWS = 3;

export interface AttentionRowData {
  groupKey: string;
  label: string;
  transactionCount: number;
  totalAmount: number;
  /** True se il gruppo contiene almeno una transazione importata dopo l'ultima visita. */
  isNew: boolean;
  /** Categoria proposta da regole o storico, se c'è. */
  suggestedCategoryId: string | null;
  /** Proposta completa (origine, motivo, confidenza), se c'è. */
  suggestion: CategorizeSuggestion | null;
  /** Chiave del merchant: serve a creare la regola quando si conferma. */
  merchantKey: string;
  /** Descrizione grezza di ogni transazione del gruppo, per mostrarle a richiesta. */
  transactionDescriptions: string[];
  /** Gruppo di entrate: cambia l'elenco di categorie selezionabili. */
  isIncome: boolean;
}

/**
 * Sceglie e ordina le righe della card dai gruppi "da categorizzare": prima quelle con una proposta (confermabili
 * in un tocco), poi le nuove, mantenendo l'ordine di arrivo a parità. Restituisce al più `limit` righe.
 */
export function buildAttentionRows(
  groups: SuggestionGroup[],
  newTransactionIds: ReadonlySet<string>,
  limit: number = ATTENTION_CARD_MAX_ROWS
): AttentionRowData[] {
  return groups
    .map((group, index) => ({
      index,
      row: {
        groupKey: group.groupKey,
        label: group.label,
        transactionCount: group.transactionIds.length,
        totalAmount: group.totalAmount,
        isNew: group.transactionIds.some((id) => newTransactionIds.has(id)),
        suggestedCategoryId: group.suggestion?.suggestedCategoryId ?? null,
        suggestion: group.suggestion,
        merchantKey: group.merchantKey,
        transactionDescriptions: group.transactionDescriptions,
        isIncome: group.totalAmount > 0,
      } satisfies AttentionRowData,
    }))
    .sort(
      (a, b) =>
        Number(b.row.suggestedCategoryId !== null) - Number(a.row.suggestedCategoryId !== null) ||
        Number(b.row.isNew) - Number(a.row.isNew) ||
        a.index - b.index
    )
    .slice(0, limit)
    .map(({ row }) => row);
}
