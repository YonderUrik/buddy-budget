/** Le cifre di un finanziamento: tasso, TAEG, rata, rate rimaste, fine e interessi ancora da pagare. */

import type { DebtView } from "@/lib/debts/view";
import { formatCurrency } from "@/lib/format";
import { formatMonthYear } from "./debts-format";

export interface DebtFactsProps {
  debt: DebtView;
  currency: string;
}

const percent = (value: number) => `${value.toFixed(2).replace(".", ",")}%`;

export function DebtFacts({ debt, currency }: DebtFactsProps) {
  const t = debt.plan.totals;
  const facts = [
    { label: "Tasso (TAN)", value: percent(debt.annualRate) },
    { label: "TAEG", value: debt.apr !== null ? percent(debt.apr) : "—" },
    { label: "Rata", value: t.finished ? "—" : formatCurrency(t.currentInstallment, currency) },
    { label: "Rate rimaste", value: String(t.remainingInstallments) },
    { label: "Finisce a", value: formatMonthYear(t.endDate) },
    { label: "Interessi ancora da pagare", value: formatCurrency(t.interestRemaining, currency, { maximumFractionDigits: 0 }) },
  ];
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {facts.map((fact) => (
        <div key={fact.label} className="rounded-lg bg-muted/50 px-3 py-2">
          <dt className="text-xs text-muted-foreground">{fact.label}</dt>
          <dd className="font-heading text-base font-medium tabular-nums text-foreground">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}
