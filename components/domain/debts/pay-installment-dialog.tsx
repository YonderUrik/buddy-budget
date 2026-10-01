"use client";

/** Dialog "Segna pagata": data e importo reali (precompilati dal piano) e, se vuoi, la transazione collegata. */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { LoanPlanRow } from "@/lib/calc/debt-plan";
import { parseAmount } from "@/lib/debts/add-form";
import { todayIso } from "@/lib/debts/dates";
import { useCreateDebtEventMutation } from "@/lib/queries/debts";
import { DebtFormField } from "./debt-form-field";
import { DebtTransactionPicker } from "./debt-transaction-picker";

export interface PayInstallmentDialogProps {
  debtId: string;
  /** Rata da segnare; null = dialog chiuso. */
  row: LoanPlanRow | null;
  currency: string;
  onOpenChange: (open: boolean) => void;
}

function PayForm({ debtId, row, currency, onDone }: { debtId: string; row: LoanPlanRow; currency: string; onDone: () => void }) {
  const mutation = useCreateDebtEventMutation();
  // Una rata non ancora scaduta si segna con la data di oggi, non con una scadenza futura.
  const [date, setDate] = React.useState(row.dueDate < todayIso() ? row.dueDate : todayIso());
  const [amount, setAmount] = React.useState(String(row.installment).replace(".", ","));
  const [transactionId, setTransactionId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const id = React.useId();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = parseAmount(amount);
    if (!value || value <= 0) return setError("Inserisci l'importo pagato");
    setError(null);
    mutation.mutate(
      { debtId, input: { type: "payment", installmentNumber: row.number, date, amount: value, transactionId: transactionId ?? undefined } },
      { onSuccess: onDone, onError: (e) => setError(e.message) }
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <DebtFormField label="Data del pagamento" htmlFor={`${id}-date`}>
          <Input id={`${id}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </DebtFormField>
        <DebtFormField label="Importo pagato" htmlFor={`${id}-amount`} hint="Quello realmente addebitato">
          <Input id={`${id}-amount`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </DebtFormField>
      </div>
      <DebtFormField label="Collega una transazione (facoltativo)" hint="Solo un promemoria: non cambia la transazione">
        <DebtTransactionPicker dueDate={row.dueDate} value={transactionId} onChange={setTransactionId} currency={currency} />
      </DebtFormField>
      {error ? <p className="text-sm text-neg" role="alert">{error}</p> : null}
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Salvo…" : "Segna pagata"}
      </Button>
    </form>
  );
}

export function PayInstallmentDialog({ debtId, row, currency, onOpenChange }: PayInstallmentDialogProps) {
  return (
    <Dialog open={row !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rata {row?.number} pagata</DialogTitle>
        </DialogHeader>
        {row ? <PayForm key={row.number} debtId={debtId} row={row} currency={currency} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
