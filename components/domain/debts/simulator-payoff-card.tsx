"use client";

/** Simulatore: più debiti. Quanto cambia estinguerli con un extra mensile, scegliendo prima il tasso più alto (valanga) o il residuo più piccolo (palla di neve). */

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { comparePayoffStrategies, MAX_PAYOFF_MONTHS, type PayoffLoan, type PayoffResult } from "@/lib/calc/debt-simulator";
import { parseAmount } from "@/lib/debts/add-form";
import { todayIso } from "@/lib/debts/dates";
import type { DebtView } from "@/lib/debts/view";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DebtFormField } from "./debt-form-field";
import { formatMonthYear } from "./debts-format";

export interface SimulatorPayoffCardProps {
  loans: DebtView[];
  currency: string;
}

const STRATEGY_COPY = [
  { key: "none", title: "Solo le rate", detail: "Come adesso" },
  { key: "avalanche", title: "Valanga", detail: "Prima il tasso più alto: paghi meno interessi" },
  { key: "snowball", title: "Palla di neve", detail: "Prima il residuo più piccolo: chiudi prima i debiti" },
] as const;

function toPayoffLoans(loans: DebtView[]): PayoffLoan[] {
  return loans
    .filter((l) => !l.plan.totals.finished && l.plan.totals.residual > 0)
    .map((l) => ({ id: l.id, name: l.name, residual: l.plan.totals.residual, annualRate: l.annualRate, installment: l.plan.totals.currentInstallment }));
}

function monthsText(result: PayoffResult): string {
  if (result.months >= MAX_PAYOFF_MONTHS) return "oltre 50 anni";
  return formatMonthYear(result.endDate);
}

export function SimulatorPayoffCard({ loans, currency }: SimulatorPayoffCardProps) {
  const [extra, setExtra] = React.useState("");
  const id = React.useId();
  const payoffLoans = React.useMemo(() => toPayoffLoans(loans), [loans]);
  const monthlyExtra = parseAmount(extra) ?? 0;
  const results = React.useMemo(() => comparePayoffStrategies(payoffLoans, Math.max(0, monthlyExtra), todayIso()), [payoffLoans, monthlyExtra]);
  if (payoffLoans.length === 0) return null;
  const money = (value: number) => formatCurrency(value, currency);
  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estinguere più debiti</CardTitle>
        <p className="text-sm text-foreground">Quanto potresti mettere in più ogni mese? Con più finanziamenti conta l&apos;ordine: le rate dei debiti chiusi si riversano sugli altri.</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="max-w-60">
          <DebtFormField label="Extra al mese" htmlFor={id}>
            <Input id={id} inputMode="decimal" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="es. 200" />
          </DebtFormField>
        </div>
        <ul className="grid gap-3 sm:grid-cols-3">
          {STRATEGY_COPY.map(({ key, title, detail }) => {
            const r = results[key];
            const saved = results.none.totalInterest - r.totalInterest;
            const disabled = key !== "none" && monthlyExtra <= 0;
            return (
              <li key={key} className={cn("rounded-lg border p-3", disabled && "opacity-50")}>
                <p className="text-sm font-medium text-foreground">{title}</p>
                <p className="mb-2 text-xs text-muted-foreground">{detail}</p>
                <dl className="flex flex-col gap-1 text-sm">
                  <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Finisci</dt><dd className="tabular-nums">{monthsText(r)}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Interessi</dt><dd className="tabular-nums">{money(r.totalInterest)}</dd></div>
                  {key !== "none" && !disabled ? (
                    <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Risparmi</dt><dd className="font-medium tabular-nums text-pos">{money(saved)}</dd></div>
                  ) : null}
                </dl>
                {!disabled && r.closeOrder.length > 1 ? <p className="mt-2 text-xs text-muted-foreground">Ordine: {r.closeOrder.join(" → ")}</p> : null}
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted-foreground">Stima semplificata (rate e tassi costanti, nessuna penale): serve a confrontare le strategie, non a prevedere gli importi esatti.</p>
      </CardContent>
    </Card>
  );
}
