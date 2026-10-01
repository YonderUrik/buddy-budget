/** "Quanto costa ogni debito": i finanziamenti aperti dal più caro (TAEG più alto) al meno caro, con il costo di ogni 1.000 € in sospeso. */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DebtView } from "@/lib/debts/view";
import { formatCurrency } from "@/lib/format";

/** Importo di riferimento per dire quanto costa il debito ("ogni 1.000 € ti costano …"). */
export const COST_REFERENCE_AMOUNT = 1000;
const percent = (value: number) => `${value.toFixed(2).replace(".", ",")}%`;

export interface DebtsCostCardProps {
  debts: DebtView[];
  currency: string;
}

/** Debiti aperti dal TAEG più alto al più basso (quelli senza TAEG in fondo). */
export function sortByCost(debts: DebtView[]): DebtView[] {
  return debts
    .filter((d) => !d.plan.totals.finished)
    .sort((a, b) => (b.apr ?? -1) - (a.apr ?? -1));
}

export function DebtsCostCard({ debts, currency }: DebtsCostCardProps) {
  const ordered = sortByCost(debts);
  if (ordered.length === 0) return null;
  const maxApr = Math.max(...ordered.map((d) => d.apr ?? 0), 0.01);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quanto costa ogni debito</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-4">
          {ordered.map((debt) => (
            <li key={debt.id} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-sm font-medium text-foreground">{debt.name}</p>
                <p className="font-heading text-lg font-medium tabular-nums text-foreground">
                  {debt.apr !== null ? percent(debt.apr) : "—"} <span className="text-xs font-normal text-muted-foreground">TAEG</span>
                </p>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div className="h-full rounded-full bg-neg" style={{ width: `${((debt.apr ?? 0) / maxApr) * 100}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(debt.plan.totals.residual, currency, { maximumFractionDigits: 0 })} da restituire
                {debt.apr !== null
                  ? ` · ogni ${formatCurrency(COST_REFERENCE_AMOUNT, currency, { maximumFractionDigits: 0 })} ti costano circa ${formatCurrency((COST_REFERENCE_AMOUNT * debt.apr) / 100, currency, { maximumFractionDigits: 0 })} l'anno`
                  : ""}
              </p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
