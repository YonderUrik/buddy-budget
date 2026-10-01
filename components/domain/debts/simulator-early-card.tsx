"use client";

/** Simulatore: estinzione anticipata. Apre il dialog già usato nel dettaglio (confronto, extra mensile, registrazione). */

import * as React from "react";
import { PiggyBankIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DebtView } from "@/lib/debts/view";
import { DebtFormField } from "./debt-form-field";
import { EarlyRepaymentDialog } from "./early-repayment-dialog";
import { SimulatorLoanSelect } from "./simulator-loan-select";

export interface SimulatorEarlyCardProps {
  loans: DebtView[];
  currency: string;
}

export function SimulatorEarlyCard({ loans, currency }: SimulatorEarlyCardProps) {
  const [loanId, setLoanId] = React.useState(loans[0]?.id ?? "");
  const [open, setOpen] = React.useState(false);
  const loan = loans.find((l) => l.id === loanId) ?? loans[0];
  const id = React.useId();
  if (!loan) return null;
  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estinzione anticipata</CardTitle>
        <p className="text-sm text-foreground">E se versassi una somma in più, una volta o ogni mese? Vedi quanto risparmi di interessi e quando finisci. Se l&apos;hai già fatto, da qui puoi anche registrarla.</p>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <DebtFormField label="Finanziamento" htmlFor={id}>
          <SimulatorLoanSelect className="sm:w-72" id={id} loans={loans} value={loan.id} onChange={setLoanId} />
        </DebtFormField>
        <Button onClick={() => setOpen(true)} disabled={loan.plan.totals.finished}>
          <PiggyBankIcon aria-hidden="true" />
          Simula
        </Button>
      </CardContent>
      <EarlyRepaymentDialog debt={loan} currency={currency} open={open} onOpenChange={setOpen} />
    </Card>
  );
}
