"use client";

/** Scheda Obiettivo FIRE: numero, progresso, anni al traguardo, Coast FIRE e sensibilità alle ipotesi. */

import { fireNumber, sensitivityByRateAndReturn, sensitivityBySpendingAndSaving, type SensitivityCell } from "@/lib/calc/fire";
import type { AnalyticsAssumptions } from "@/lib/analitiche/assumptions";
import type { AnalyticsBase } from "@/lib/analitiche/base";
import type { AnalyticsPlan } from "@/lib/analitiche/plan";
import { cn } from "@/lib/utils";
import { AnalyticsCard, Metric, MissingData } from "./analytics-card";
import { formatYears, money, pct } from "./analytics-format";

export interface FireTabProps {
  base: AnalyticsBase;
  assumptions: AnalyticsAssumptions;
  plan: AnalyticsPlan;
}

const RATE_STEPS = [-0.01, -0.005, 0, 0.005, 0.01];
const RETURN_STEPS = [-0.02, -0.01, 0, 0.01, 0.02];
const SPENDING_CHANGES = [-0.2, -0.1, 0, 0.1, 0.2];
const SAVING_CHANGES = [-0.2, -0.1, 0, 0.1, 0.2];

function signed(value: number): string {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${pct(Math.abs(value), 0)}`;
}

function SensitivityTable({ cells, rowLabel, columnLabel, rows, columns }: { cells: SensitivityCell[][]; rowLabel: string; columnLabel: string; rows: string[]; columns: string[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm tabular-nums">
        <caption className="pb-1 text-left text-xs text-muted-foreground">
          Righe: {rowLabel} · Colonne: {columnLabel}
        </caption>
        <thead>
          <tr>
            <th className="p-1.5" />
            {columns.map((c) => (
              <th key={c} scope="col" className="p-1.5 text-right text-xs font-medium text-muted-foreground">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cells.map((row, i) => (
            <tr key={rows[i]}>
              <th scope="row" className="p-1.5 text-left text-xs font-medium text-muted-foreground">
                {rows[i]}
              </th>
              {row.map((cell, j) => (
                <td key={columns[j]} className={cn("p-1.5 text-right", i === 2 && j === 2 && "rounded bg-primary/10 font-medium")}>
                  {cell.years === null ? "—" : cell.years === 0 ? "ok" : `${cell.years.toFixed(1).replace(".", ",")} a`}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FireTab({ base, assumptions: a, plan }: FireTabProps) {
  const { currency } = base;
  if (plan.target === null || plan.spending === null) {
    return <MissingData>Per calcolare il numero FIRE serve la tua spesa annua. Scrivila nelle ipotesi qui sopra, oppure registra almeno 3 mesi di movimenti e la ricavo da lì.</MissingData>;
  }
  const savings = plan.savings ?? 0;
  const finishYear = plan.yearsToFire !== null ? new Date().getFullYear() + Math.ceil(plan.yearsToFire) : null;
  const lean = base.cashflow.leanSpending !== null ? fireNumber(base.cashflow.leanSpending, a.withdrawalRate) : null;
  const progress = Math.min(plan.progress ?? 0, 1);
  const rateRows = RATE_STEPS.map((s) => a.withdrawalRate + s);
  const returnCols = RETURN_STEPS.map((s) => a.expectedReturn + s);
  const rateCells = sensitivityByRateAndReturn({ annualSpending: plan.spending, current: plan.wealth, annualSaving: savings, withdrawalRates: rateRows.map((r) => Math.max(r, 0.01)), realReturns: returnCols });
  const spendCells = sensitivityBySpendingAndSaving({
    annualSpending: plan.spending,
    withdrawalRate: a.withdrawalRate,
    realReturn: a.expectedReturn,
    current: plan.wealth,
    annualSaving: savings,
    spendingChanges: SPENDING_CHANGES,
    savingChanges: SAVING_CHANGES,
  });

  return (
    <div className="flex flex-col gap-4">
      <AnalyticsCard title="Il tuo numero FIRE" explainer="fire-number">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Metric label="Numero FIRE" value={money(plan.target, currency)} sub={plan.taxShare > 0 ? `${money(plan.fireNumberGross ?? 0, currency)} prima delle imposte` : `spesa ${money(plan.spending, currency)} ÷ ${pct(a.withdrawalRate)}`} />
          <Metric label="Il tuo patrimonio" value={money(plan.wealth, currency)} sub={`${pct(plan.progress ?? 0, 0)} del traguardo`} />
          <Metric label="Anni al traguardo" value={formatYears(plan.yearsToFire)} sub={finishYear ? `intorno al ${finishYear}` : savings <= 0 ? "con risparmio nullo non ci arrivi" : undefined} />
        </div>
        <div role="progressbar" aria-label="Avanzamento verso il numero FIRE" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${progress * 100}%` }} />
        </div>
        <p className="text-sm text-muted-foreground">
          Con un risparmio di {money(savings, currency)} l&apos;anno e un rendimento reale del {pct(a.expectedReturn)}.{" "}
          {plan.spendingSource === "dati" ? "La spesa viene dai tuoi ultimi 12 mesi. " : ""}
          {lean !== null ? `Se vivessi solo con le spese Dovute e Saltuarie il numero scenderebbe a ${money(lean, currency)} («lean FIRE»).` : ""}
        </p>
      </AnalyticsCard>

      <AnalyticsCard title="Coast FIRE" explainer="coast">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {plan.coast.map((c) => (
            <Metric key={c.years} label={`Fra ${c.years} anni`} value={money(c.number, currency)} tone={plan.wealth >= c.number ? "pos" : "default"} sub={plan.wealth >= c.number ? "già raggiunto" : undefined} />
          ))}
        </div>
      </AnalyticsCard>

      <AnalyticsCard title="Sensibilità alle ipotesi" explainer="sensitivity">
        <SensitivityTable
          cells={rateCells}
          rowLabel="tasso di prelievo"
          columnLabel="rendimento reale"
          rows={rateRows.map((r) => pct(Math.max(r, 0.01)))}
          columns={returnCols.map((r) => pct(r))}
        />
        <SensitivityTable cells={spendCells} rowLabel="spesa" columnLabel="risparmio" rows={SPENDING_CHANGES.map(signed)} columns={SAVING_CHANGES.map(signed)} />
        <p className="text-xs text-muted-foreground">Anni al numero FIRE. «—» = oltre 80 anni o mai; «ok» = già raggiunto. La cella evidenziata è la tua ipotesi.</p>
      </AnalyticsCard>
    </div>
  );
}
