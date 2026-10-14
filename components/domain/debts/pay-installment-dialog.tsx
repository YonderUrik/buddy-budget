"use client";
import { useLocalization } from "@/lib/localization/provider";

/** Dialog "Segna pagata": data e importo reali (precompilati dal piano) e, se vuoi, la transazione collegata. */

import { FormDialogContent } from "@/components/domain/shared";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { CircleCheckIcon, LinkIcon, WalletIcon } from "lucide-react";
import { DialogActions, DialogSection, DialogSections, PanelDialogHeader } from "@/components/domain/investments/light";
import { Dialog } from "@/components/ui/dialog";
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
  const { t: tr } = useLocalization();
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
    if (!value || value <= 0) return setError(tr("Inserisci l'importo pagato"));
    setError(null);
    mutation.mutate(
      { debtId, input: { type: "payment", installmentNumber: row.number, date, amount: value, transactionId: transactionId ?? undefined } },
      { onSuccess: onDone, onError: (e) => setError(e.message) }
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <DialogSections>
        <DialogSection title={tr("Il pagamento")} icon={WalletIcon}>
          <div className="grid grid-cols-2 gap-3">
            <DebtFormField label={tr("Data del pagamento")} htmlFor={`${id}-date`}>
              <Input id={`${id}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </DebtFormField>
            <DebtFormField label={tr("Importo pagato")} htmlFor={`${id}-amount`} hint={tr("Quello realmente addebitato")}>
              <Input id={`${id}-amount`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </DebtFormField>
          </div>
        </DialogSection>
        <details className="group rounded-xl border p-3" open={transactionId !== null}>
          <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 text-sm font-medium text-foreground">
            <LinkIcon className="size-4 text-muted-foreground" aria-hidden="true" />{" "}{tr("Collega una transazione")}{" "}<span className="font-normal text-muted-foreground">{tr("(facoltativo)")}</span>
          </summary>
          <p className="mt-2 text-sm text-muted-foreground">{tr("Solo un promemoria: non cambia la transazione.")}</p>
          <div className="mt-3">
            <DebtTransactionPicker dueDate={row.dueDate} expectedAmount={row.installment} value={transactionId} onChange={setTransactionId} currency={currency} />
          </div>
        </details>
      </DialogSections>
      {error ? <p className="text-sm text-neg" role="alert">{tr(error)}</p> : null}
      <DialogActions>
        <span />
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? tr("Salvo…") : tr("Segna pagata")}
        </Button>
      </DialogActions>
    </form>
  );
}

export function PayInstallmentDialog({ debtId, row, currency, onOpenChange }: PayInstallmentDialogProps) {
  const { t: tr } = useLocalization();
  return (
    <Dialog open={row !== null} onOpenChange={onOpenChange}>
      <FormDialogContent>
        <PanelDialogHeader icon={CircleCheckIcon} title={<>{tr("Rata")}{" "}{row?.number}{" "}{tr("pagata")}</>} description={tr("Data e importo reali, precompilati dal piano.")} />
        {row ? <PayForm key={row.number} debtId={debtId} row={row} currency={currency} onDone={() => onOpenChange(false)} /> : null}
      </FormDialogContent>
    </Dialog>
  );
}
