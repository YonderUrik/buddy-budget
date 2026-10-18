"use client";
import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";

/** Surroga o nuova offerta su un finanziamento: l'offerta contro le condizioni attuali, spese e penale comprese. */

import * as React from "react";
import { SimulationResult } from "@/components/domain/shared";
import { Input } from "@/components/ui/input";
import { compareRefinance } from "@/lib/calc/debt-simulator";
import { parseAmount } from "@/lib/debts/add-form";
import { todayIso } from "@/lib/debts/dates";
import type { DebtView } from "@/lib/debts/view";

import { localizedDebtFormats } from "./debts-format";
import { DebtFormField } from "./debt-form-field";

export interface DebtRefinanceSimProps {
  debt: DebtView;
  currency: string;
}

function Side({ title, rows }: { title: string; rows: { label: string; value: string }[] }) {
  const { t: tr } = useLocalization();
  return (
    <div className="pt-3">
      <p className="mb-2 text-sm font-medium text-foreground">{tr(title)}</p>
      <dl className="flex flex-col gap-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-2 text-sm">
            <dt className="text-muted-foreground">{tr(row.label)}</dt>
            <dd className="text-right tabular-nums text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function DebtRefinanceSim({ debt, currency }: DebtRefinanceSimProps) {
  const { formatMonthYear } = localizedDebtFormats(useLocalization().language);

  const { locale: formattingLocale } = useLocalization();
  const { formatCurrency } = localizedFormats(formattingLocale);

  const { t: tr } = useLocalization();
  const [rate, setRate] = React.useState("");
  const [installments, setInstallments] = React.useState("");
  const [costs, setCosts] = React.useState("");
  const [penalty, setPenalty] = React.useState("");
  const base = React.useId();
  const money = (value: number) => formatCurrency(value, currency);

  const result = React.useMemo(() => {
    const annualRate = rate.trim() === "" ? undefined : parseAmount(rate, formattingLocale);
    const count = parseAmount(installments, formattingLocale);
    if (annualRate === undefined || !count || count < 1 || !Number.isInteger(count) || annualRate < 0) return null;
    return compareRefinance(debt.plan.totals, todayIso(), { annualRate, installments: count, upfrontCosts: parseAmount(costs, formattingLocale) ?? 0, penalty: parseAmount(penalty, formattingLocale) ?? 0 });
  }, [debt, rate, installments, costs, penalty, formattingLocale]);

  const saving = result?.netSaving ?? 0;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-foreground">{tr("Un'altra banca offre un tasso migliore? Inserisci l'offerta e vedi se, spese incluse, conviene.")}</p>
      <div className="grid grid-cols-2 gap-3">
        <DebtFormField label={tr("Nuovo TAN (%)")} htmlFor={`${base}-rate`}>
          <Input id={`${base}-rate`} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder={tr("es. 3,5")} />
        </DebtFormField>
        <DebtFormField label={tr("Numero di rate")} htmlFor={`${base}-n`}>
          <Input id={`${base}-n`} inputMode="numeric" value={installments} onChange={(e) => setInstallments(e.target.value)} placeholder={String(debt.plan.totals.remainingInstallments)} />
        </DebtFormField>
        <DebtFormField label={tr("Spese della nuova offerta")} htmlFor={`${base}-costs`} hint={tr("Istruttoria, perizia, imposte")}>
          <Input id={`${base}-costs`} inputMode="decimal" value={costs} onChange={(e) => setCosts(e.target.value)} placeholder={"0"} />
        </DebtFormField>
        <DebtFormField label={tr("Penale di estinzione")} htmlFor={`${base}-pen`} hint={tr("Quella sul finanziamento attuale")}>
          <Input id={`${base}-pen`} inputMode="decimal" value={penalty} onChange={(e) => setPenalty(e.target.value)} placeholder={"0"} />
        </DebtFormField>
      </div>
      {result ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Side title={tr("Resti dove sei")} rows={[
            { label: "Rata", value: money(result.currentInstallment) },
            { label: "Finisci", value: formatMonthYear(result.currentEndDate) },
            { label: "Interessi che restano", value: money(result.currentInterestRemaining) },
          ]} />
          <Side title={tr("Cambi con la nuova offerta")} rows={[
            { label: "Rata", value: money(result.newInstallment) },
            { label: "Finisci", value: formatMonthYear(result.newEndDate) },
            { label: "Interessi", value: money(result.newInterest) },
            { label: "Spese e penale", value: money(result.switchCosts) },
          ]} />
          <SimulationResult
            className="sm:col-span-2"
            label={saving > 0 ? tr("Conviene: risparmi") : tr("Non conviene: spenderesti in più")}
            value={money(Math.abs(saving))}
            tone={saving > 0 ? "pos" : "neg"}
            caption={saving > 0
              ? (result.breakEvenMonths ? tr("Al netto delle spese, che rientrano in {0} mesi.", {0: result.breakEvenMonths}) : tr("Al netto delle spese."))
              : tr("Tra interessi e spese.")}
          />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{tr("Inserisci almeno il nuovo tasso e il numero di rate per vedere il confronto.")}</p>
      )}
    </div>
  );
}
