/** Le cifre di un finanziamento: anello di avanzamento col residuo, poi rata, tasso e TAEG, rate rimaste, fine e interessi che restano. */

import type { DebtView } from "@/lib/debts/view";
import { formatCurrency } from "@/lib/format";
import { DebtRing } from "./debt-ring";
import { formatMonthYear } from "./debts-format";

export interface DebtFactsProps {
  debt: DebtView;
  currency: string;
}

const percent = (value: number) => `${value.toFixed(2).replace(".", ",")}%`;

/** Quota del capitale già restituita (0-1), dal piano. */
export function repaidShare(debt: DebtView): number {
  const first = debt.plan.rows[0];
  if (!first) return 0;
  const total = first.residual + first.capital;
  return total > 0 ? Math.min(1, Math.max(0, 1 - debt.plan.totals.residual / total)) : 0;
}

export function DebtFacts({ debt, currency }: DebtFactsProps) {
  const t = debt.plan.totals;
  const share = repaidShare(debt);
  const facts = [
    { label: "Rata", value: t.finished ? "—" : formatCurrency(t.currentInstallment, currency) },
    { label: "Rate rimaste", value: String(t.remainingInstallments) },
    { label: "Tasso (TAN) · TAEG", value: `${percent(debt.annualRate)} · ${debt.apr !== null ? percent(debt.apr) : "—"}` },
    { label: "Interessi che restano", value: formatCurrency(t.interestRemaining, currency, { maximumFractionDigits: 0 }), tone: "text-neg" },
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <DebtRing fraction={share} label={`${Math.round(share * 100)}%`} caption="restituito" />
        <div className="min-w-0">
          <p className="font-heading text-3xl font-medium tabular-nums text-foreground">{formatCurrency(t.residual, currency, { maximumFractionDigits: 0 })}</p>
          <p className="text-sm text-muted-foreground">{t.finished ? "Estinto" : `ancora da restituire · finisce a ${formatMonthYear(t.endDate)}`}</p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt className="text-xs text-muted-foreground">{fact.label}</dt>
            <dd className={`font-heading text-base font-medium tabular-nums ${fact.tone ?? "text-foreground"}`}>{fact.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
