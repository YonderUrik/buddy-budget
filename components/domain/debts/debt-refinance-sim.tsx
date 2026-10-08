"use client";

/** Surroga o nuova offerta su un finanziamento: l'offerta contro le condizioni attuali, spese e penale comprese. */

import * as React from "react";
import { Input } from "@/components/ui/input";
import { compareRefinance } from "@/lib/calc/debt-simulator";
import { parseAmount } from "@/lib/debts/add-form";
import { todayIso } from "@/lib/debts/dates";
import type { DebtView } from "@/lib/debts/view";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { formatMonthYear } from "./debts-format";
import { DebtFormField } from "./debt-form-field";

export interface DebtRefinanceSimProps {
  debt: DebtView;
  currency: string;
}

function Side({ title, rows }: { title: string; rows: { label: string; value: string }[] }) {
  return (
    <div className="border-t pt-3">
      <p className="mb-2 text-sm font-medium text-foreground">{title}</p>
      <dl className="flex flex-col gap-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-2 text-sm">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="text-right tabular-nums text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function DebtRefinanceSim({ debt, currency }: DebtRefinanceSimProps) {
  const [rate, setRate] = React.useState("");
  const [installments, setInstallments] = React.useState("");
  const [costs, setCosts] = React.useState("");
  const [penalty, setPenalty] = React.useState("");
  const base = React.useId();
  const money = (value: number) => formatCurrency(value, currency);

  const result = React.useMemo(() => {
    const annualRate = rate.trim() === "" ? undefined : parseAmount(rate);
    const count = parseAmount(installments);
    if (annualRate === undefined || !count || count < 1 || !Number.isInteger(count) || annualRate < 0) return null;
    return compareRefinance(debt.plan.totals, todayIso(), { annualRate, installments: count, upfrontCosts: parseAmount(costs) ?? 0, penalty: parseAmount(penalty) ?? 0 });
  }, [debt, rate, installments, costs, penalty]);

  const saving = result?.netSaving ?? 0;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-foreground">Un&apos;altra banca ti offre un tasso migliore? Inserisci l&apos;offerta: sul residuo di oggi vedi se, tolte le spese, conviene davvero.</p>
      <div className="grid grid-cols-2 gap-3">
        <DebtFormField label="Nuovo TAN (%)" htmlFor={`${base}-rate`}>
          <Input id={`${base}-rate`} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="es. 3,5" />
        </DebtFormField>
        <DebtFormField label="Numero di rate" htmlFor={`${base}-n`}>
          <Input id={`${base}-n`} inputMode="numeric" value={installments} onChange={(e) => setInstallments(e.target.value)} placeholder={String(debt.plan.totals.remainingInstallments)} />
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
          <Side title="Resti dove sei" rows={[
            { label: "Rata", value: money(result.currentInstallment) },
            { label: "Finisci", value: formatMonthYear(result.currentEndDate) },
            { label: "Interessi che restano", value: money(result.currentInterestRemaining) },
          ]} />
          <Side title="Cambi con la nuova offerta" rows={[
            { label: "Rata", value: money(result.newInstallment) },
            { label: "Finisci", value: formatMonthYear(result.newEndDate) },
            { label: "Interessi", value: money(result.newInterest) },
            { label: "Spese e penale", value: money(result.switchCosts) },
          ]} />
          <p className={cn("text-sm sm:col-span-2", saving > 0 ? "text-pos" : "text-neg")}>
            {saving > 0
              ? `Conviene: risparmi ${money(saving)} al netto delle spese${result.breakEvenMonths ? `, e le spese rientrano in ${result.breakEvenMonths} mesi` : ""}.`
              : `Non conviene: spenderesti ${money(Math.abs(saving))} in più tra interessi e spese.`}
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Inserisci almeno il nuovo tasso e il numero di rate per vedere il confronto.</p>
      )}
    </div>
  );
}
