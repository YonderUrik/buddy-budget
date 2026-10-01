/** Elenco dei finanziamenti come card selezionabili: nome, residuo, rata, avanzamento. La card scelta guida il dettaglio sotto. */

import type { DebtView } from "@/lib/debts/view";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface DebtSelectorProps {
  debts: DebtView[];
  selectedId: string;
  onSelect: (id: string) => void;
  currency: string;
}

/** Quota del capitale già restituita (0-1), dal piano. */
export function repaidShare(debt: DebtView): number {
  const first = debt.plan.rows[0];
  if (!first) return 0;
  const total = first.residual + first.capital;
  return total > 0 ? Math.min(1, Math.max(0, 1 - debt.plan.totals.residual / total)) : 0;
}

export function DebtSelector({ debts, selectedId, onSelect, currency }: DebtSelectorProps) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2" aria-label="I tuoi finanziamenti">
      {debts.map((debt) => {
        const selected = debt.id === selectedId;
        const share = repaidShare(debt);
        return (
          <li key={debt.id}>
            <button
              type="button"
              onClick={() => onSelect(debt.id)}
              aria-pressed={selected}
              className={cn(
                "flex w-full flex-col gap-2 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/60",
                selected && "border-primary ring-1 ring-primary"
              )}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="font-medium text-foreground">{debt.name}</span>
                <span className="font-heading text-lg font-medium tabular-nums text-foreground">
                  {formatCurrency(debt.plan.totals.residual, currency, { maximumFractionDigits: 0 })}
                </span>
              </span>
              <span className="text-xs text-muted-foreground">
                {debt.plan.totals.finished
                  ? "Estinto"
                  : `${formatCurrency(debt.plan.totals.currentInstallment, currency)} al mese · ${debt.plan.totals.remainingInstallments} rate rimaste${debt.apr !== null ? ` · TAEG ${debt.apr.toFixed(2).replace(".", ",")}%` : ""}`}
              </span>
              <span className="h-1.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${Math.round(share * 100)}% restituito`}>
                <span className="block h-full rounded-full bg-primary" style={{ width: `${share * 100}%` }} />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
