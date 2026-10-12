import type { AutomaticCategorySource } from "./category-source";
import { merchantKey } from "./merchant-key";

/** Movimento categorizzato da solo, nella forma che serve a «Fatte da sole». */
export interface AutoCategorizedTransaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  categoryId: string;
  source: AutomaticCategorySource;
  /** Sicurezza della proposta applicata (0-1); null per le regole. */
  confidence: number | null;
  categorizedAt: string;
}

/** Movimenti dello stesso esercente, direzione, categoria e origine, applicati da soli. */
export interface AutoCategorizedGroup {
  groupKey: string;
  merchantKey: string;
  /** Descrizione del movimento più recente. */
  label: string;
  categoryId: string;
  source: AutomaticCategorySource;
  /** La sicurezza più bassa fra i movimenti del gruppo (null per le regole). */
  confidence: number | null;
  transactionIds: string[];
  transactionDescriptions: string[];
  transactionDates: string[];
  transactionAmounts: number[];
  totalAmount: number;
  /** Quando è stato categorizzato l'ultimo movimento del gruppo (ISO). */
  lastCategorizedAt: string;
}

/**
 * Raggruppa i movimenti categorizzati da soli per esercente, direzione, categoria e origine: una riga per scelta da
 * controllare, non una per movimento. Ordinati dal gruppo applicato più di recente; dentro il gruppo dal movimento
 * più recente.
 */
export function groupAutoCategorized(rows: readonly AutoCategorizedTransaction[]): AutoCategorizedGroup[] {
  const byKey = new Map<string, AutoCategorizedTransaction[]>();
  for (const row of [...rows].sort((a, b) => b.date.localeCompare(a.date))) {
    const key = merchantKey(row.description);
    const direction = row.amount >= 0 ? "entrata" : "uscita";
    const groupKey = `${key}::${direction}::${row.categoryId}::${row.source}`;
    const bucket = byKey.get(groupKey);
    if (bucket) bucket.push(row);
    else byKey.set(groupKey, [row]);
  }

  const groups: AutoCategorizedGroup[] = [];
  for (const [groupKey, items] of byKey) {
    const confidences = items.map((item) => item.confidence).filter((value): value is number => value !== null);
    groups.push({
      groupKey,
      merchantKey: merchantKey(items[0].description),
      label: items[0].description,
      categoryId: items[0].categoryId,
      source: items[0].source,
      confidence: confidences.length > 0 ? Math.min(...confidences) : null,
      transactionIds: items.map((item) => item.id),
      transactionDescriptions: items.map((item) => item.description),
      transactionDates: items.map((item) => item.date),
      transactionAmounts: items.map((item) => item.amount),
      totalAmount: Math.round(items.reduce((sum, item) => sum + item.amount, 0) * 100) / 100,
      lastCategorizedAt: items.reduce((latest, item) => (item.categorizedAt > latest ? item.categorizedAt : latest), items[0].categorizedAt),
    });
  }
  return groups.sort((a, b) => b.lastCategorizedAt.localeCompare(a.lastCategorizedAt) || b.transactionIds.length - a.transactionIds.length);
}
