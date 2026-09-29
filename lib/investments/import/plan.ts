import type { InvestmentTransactionType } from "@/lib/db/schema/investments";
import { findOversoldTransaction, type InvestmentTransactionInput } from "@/lib/calc/investments";

/** Operazione da importare già abbinata allo strumento (id reale o provvisorio per quelli ancora da creare). */
export interface PlannedOperation {
  line: number;
  instrumentId: string;
  type: InvestmentTransactionType;
  date: string;
  quantity: number;
  price: number;
  grossAmount: number | null;
}

/** Operazione già salvata, nei campi che servono a riconoscere un doppione. */
export interface ExistingOperation {
  instrumentId: string;
  type: InvestmentTransactionType;
  date: string;
  quantity: string | number;
  price: string | number;
  grossAmount: string | number | null;
}

/** Esito di una riga: nuova, già presente (si salta) o in errore (blocca l'import). */
export interface PlannedRow {
  line: number;
  status: "new" | "duplicate" | "error";
  message?: string;
}

/** Impronta di un'operazione: stessi strumento, tipo, data, quote, prezzo e importo = stessa operazione. */
function fingerprint(op: Omit<ExistingOperation, "instrumentId"> & { instrumentId: string }): string {
  const round = (value: string | number | null, digits: number) => (value === null ? "" : Number(value).toFixed(digits));
  return [op.instrumentId, op.type, op.date, round(op.quantity, 8), round(op.price, 6), round(op.grossAmount, 2)].join("|");
}

/**
 * Decide cosa importare: un'operazione identica a una già salvata è un doppione (così reimportare lo stesso file non
 * duplica nulla). Il confronto conta le ripetizioni: due acquisti identici nel file contro uno salvato → uno nuovo.
 * Poi, per ogni strumento, verifica che nessuna vendita superi le quote possedute contando anche quelle già salvate.
 */
export function planImport(operations: PlannedOperation[], existing: ExistingOperation[]): PlannedRow[] {
  const available = new Map<string, number>();
  for (const op of existing) {
    const key = fingerprint(op);
    available.set(key, (available.get(key) ?? 0) + 1);
  }

  const rows = new Map<number, PlannedRow>();
  const fresh: PlannedOperation[] = [];
  for (const op of operations) {
    const key = fingerprint(op);
    const left = available.get(key) ?? 0;
    if (left > 0) {
      available.set(key, left - 1);
      rows.set(op.line, { line: op.line, status: "duplicate" });
    } else {
      rows.set(op.line, { line: op.line, status: "new" });
      fresh.push(op);
    }
  }

  const byInstrument = new Map<string, InvestmentTransactionInput[]>();
  const push = (t: InvestmentTransactionInput) => byInstrument.set(t.instrumentId, [...(byInstrument.get(t.instrumentId) ?? []), t]);
  for (const op of existing) push({ ...toInput(op), id: "esistente" });
  for (const op of fresh) push({ ...toInput(op), id: `riga-${op.line}` });

  for (const [instrumentId, list] of byInstrument) {
    if (!fresh.some((op) => op.instrumentId === instrumentId)) continue;
    const oversold = findOversoldTransaction(list);
    if (!oversold) continue;
    const line = oversold.id.startsWith("riga-") ? Number(oversold.id.slice(5)) : null;
    // Se a sforare è una vendita già salvata, la colpa è di una vendita del file che la precede.
    const ownSales = fresh.filter((op) => op.instrumentId === instrumentId && op.type !== "acquisto" && op.date <= oversold.date);
    const target = line ?? ownSales.at(-1)?.line ?? fresh.find((op) => op.instrumentId === instrumentId)?.line;
    if (target !== undefined) {
      rows.set(target, { line: target, status: "error", message: "Vende più quote di quelle possedute a quella data" });
    }
  }
  return operations.map((op) => rows.get(op.line)!);
}

function toInput(op: ExistingOperation): Omit<InvestmentTransactionInput, "id"> {
  return {
    instrumentId: op.instrumentId,
    type: op.type,
    date: op.date,
    quantity: String(op.quantity),
    price: String(op.price),
    fxRate: "1",
    fees: "0",
    taxes: "0",
    grossAmount: op.grossAmount === null ? null : String(op.grossAmount),
  };
}
