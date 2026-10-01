"use client";

/** Simulatore: surroga. Un'offerta nuova sul residuo di oggi contro le condizioni attuali, spese e penale comprese. */

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { compareRefinance } from "@/lib/calc/debt-simulator";
import { todayIso } from "@/lib/debts/dates";
import { parseAmount } from "@/lib/debts/add-form";
import type { DebtView } from "@/lib/debts/view";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DebtFormField } from "./debt-form-field";
import { formatMonthYear } from "./debts-format";
import { SimulatorLoanSelect } from "./simulator-loan-select";

export interface SimulatorRefinanceCardProps {
  loans: DebtView[];
  currency: string;
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "pos" | "neg" }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("text-right tabular-nums text-foreground", strong && "font-medium", tone === "pos" && "text-pos", tone === "neg" && "text-neg")}>{value}</dd>
    </div>
  );
}

export function SimulatorRefinanceCard({ loans, currency }: SimulatorRefinanceCardProps) {
  const open = loans.filter((l) => !l.plan.totals.finished);
  const [loanId, setLoanId] = React.useState(open[0]?.id ?? "");
  const [rate, setRate] = React.useState("");
  const [installments, setInstallments] = React.useState("");
  const [costs, setCosts] = React.useState("");
  const [penalty, setPenalty] = React.useState("");
  const base = React.useId();
  const loan = open.find((l) => l.id === loanId) ?? open[0];
  const money = (value: number) => formatCurrency(value, currency);

  const result = React.useMemo(() => {
    if (!loan) return null;
    const annualRate = rate.trim() === "" ? undefined : parseAmount(rate);
    const count = parseAmount(installments);
    if (annualRate === undefined || !count || count < 1 || !Number.isInteger(count) || annualRate < 0) return null;
    return compareRefinance(loan.plan.totals, todayIso(), {
      annualRate,
      installments: count,
      upfrontCosts: parseAmount(costs) ?? 0,
      penalty: parseAmount(penalty) ?? 0,
    });
  }, [loan, rate, installments, costs, penalty]);

  if (!loan) return null;
  const saving = result?.netSaving ?? 0;
  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Surroga o nuova offerta</CardTitle>
        <p className="text-sm text-foreground">Un&apos;altra banca ti offre un tasso migliore? Inserisci l&apos;offerta: sul residuo di oggi vedi se, tolte le spese, conviene davvero.</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <DebtFormField label="Finanziamento" htmlFor={`${base}-loan`}>
            <SimulatorLoanSelect id={`${base}-loan`} loans={open} value={loan.id} onChange={setLoanId} />
          </DebtFormField>
          <DebtFormField label="Nuovo TAN (%)" htmlFor={`${base}-rate`}>
            <Input id={`${base}-rate`} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="es. 3,5" />
          </DebtFormField>
          <DebtFormField label="Numero di rate" htmlFor={`${base}-n`}>
            <Input id={`${base}-n`} inputMode="numeric" value={installments} onChange={(e) => setInstallments(e.target.value)} placeholder={String(loan.plan.totals.remainingInstallments)} />
          </DebtFormField>
          <DebtFormField label="Spese della nuova offerta" htmlFor={`${base}-costs`} hint="Istruttoria, perizia, imposte">
            <Input id={`${base}-costs`} inputMode="decimal" value={costs} onChange={(e) => setCosts(e.target.value)} placeholder="0" />
          </DebtFormField>
          <DebtFormField label="Penale di estinzione" htmlFor={`${base}-pen`} hint="Quella sul finanziamento attuale">
            <Input id={`${base}-pen`} inputMode="decimal" value={penalty} onChange={(e) => setPenalty(e.target.value)} placeholder="0" />
          </DebtFormField>
        </div>
        {result ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-3">
              <p className="mb-2 text-sm font-medium text-foreground">Resti dove sei</p>
              <dl className="flex flex-col gap-1">
                <Row label="Rata" value={money(result.currentInstallment)} />
                <Row label="Finisci" value={formatMonthYear(result.currentEndDate)} />
                <Row label="Interessi che restano" value={money(result.currentInterestRemaining)} />
              </dl>
            </div>
            <div className="rounded-lg border p-3">
              <p className="mb-2 text-sm font-medium text-foreground">Cambi con la nuova offerta</p>
              <dl className="flex flex-col gap-1">
                <Row label="Rata" value={money(result.newInstallment)} />
                <Row label="Finisci" value={formatMonthYear(result.newEndDate)} />
                <Row label="Interessi" value={money(result.newInterest)} />
                <Row label="Spese e penale" value={money(result.switchCosts)} />
              </dl>
            </div>
            <p className={cn("text-sm sm:col-span-2", saving > 0 ? "text-pos" : "text-neg")}>
              {saving > 0
                ? `Conviene: risparmi ${money(saving)} al netto delle spese${result.breakEvenMonths ? `, e le spese rientrano in ${result.breakEvenMonths} mesi` : ""}.`
                : `Non conviene: spenderesti ${money(Math.abs(saving))} in più tra interessi e spese.`}
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Inserisci almeno il nuovo tasso e il numero di rate per vedere il confronto.</p>
        )}
      </CardContent>
    </Card>
  );
}
