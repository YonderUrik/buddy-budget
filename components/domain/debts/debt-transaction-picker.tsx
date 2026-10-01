"use client";

/**
 * Scelta facoltativa della transazione che corrisponde a una rata: mostra le uscite vicine alla scadenza. Non collega
 * mai niente da sola: se non scegli nulla la rata si segna senza transazione.
 */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addDaysIso } from "@/lib/debts/dates";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { useTransactionsQuery } from "@/lib/queries/transactions";

/** Giorni prima e dopo la scadenza in cui cercare la transazione. */
export const TRANSACTION_SEARCH_WINDOW_DAYS = 20;
const NO_TRANSACTION = "none";
const NO_TRANSACTION_LABEL = "Nessuna transazione collegata";

export interface DebtTransactionPickerProps {
  /** Scadenza della rata (ISO): centro dell'intervallo di ricerca. */
  dueDate: string;
  value: string | null;
  onChange: (transactionId: string | null) => void;
  currency: string;
}

export function DebtTransactionPicker({ dueDate, value, onChange, currency }: DebtTransactionPickerProps) {
  const query = useTransactionsQuery(
    addDaysIso(dueDate, -TRANSACTION_SEARCH_WINDOW_DAYS),
    addDaysIso(dueDate, TRANSACTION_SEARCH_WINDOW_DAYS),
    "uscita"
  );
  const transactions = query.data ?? [];
  const labels = new Map(
    transactions.map((t) => [t.id, `${formatShortDate(t.date)} · ${t.description} · ${formatCurrency(Math.abs(Number(t.amount)), currency)}`])
  );

  return (
    <Select value={value ?? NO_TRANSACTION} onValueChange={(v) => onChange(!v || v === NO_TRANSACTION ? null : v)}>
      <SelectTrigger className="w-full" aria-label="Transazione collegata">
        <SelectValue>{(v: string | null) => (v && v !== NO_TRANSACTION ? (labels.get(v) ?? "") : NO_TRANSACTION_LABEL)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_TRANSACTION}>{NO_TRANSACTION_LABEL}</SelectItem>
        {transactions.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            {labels.get(t.id)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
