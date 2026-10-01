/** Elenco delle linee di credito come card selezionabili: nome, utilizzato sul fido, tasso. La scelta guida il dettaglio sotto. */

import { TriangleAlert } from "lucide-react";
import type { CreditLineView } from "@/lib/debts/view";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface CreditLineSelectorProps {
  lines: CreditLineView[];
  selectedId: string;
  onSelect: (id: string) => void;
  currency: string;
}

const percent = (value: number) => `${value.toFixed(2).replace(".", ",")}%`;

export function CreditLineSelector({ lines, selectedId, onSelect, currency }: CreditLineSelectorProps) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2" aria-label="Le tue linee di credito">
      {lines.map((line) => {
        const selected = line.id === selectedId;
        const alerting = line.alertTriggered || line.plan.overLimit;
        return (
          <li key={line.id}>
            <button
              type="button"
              onClick={() => onSelect(line.id)}
              aria-pressed={selected}
              className={cn(
                "flex w-full flex-col gap-2 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/60",
                selected && "border-primary ring-1 ring-primary"
              )}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  {line.name}
                  {alerting ? <TriangleAlert size={14} className="text-neg" aria-label="Soglia di allerta raggiunta" /> : null}
                </span>
                <span className="font-heading text-lg font-medium tabular-nums text-foreground">{formatCurrency(line.plan.used, currency, { maximumFractionDigits: 0 })}</span>
              </span>
              <span className="text-xs text-muted-foreground">
                su {formatCurrency(line.creditLimit, currency, { maximumFractionDigits: 0 })} di fido · tasso {percent(line.plan.currentRate)}
              </span>
              <span className="h-1.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${Math.round(line.plan.usageRatio * 100)}% del fido utilizzato`}>
                <span className={cn("block h-full rounded-full", alerting ? "bg-neg" : "bg-primary")} style={{ width: `${Math.min(1, line.plan.usageRatio) * 100}%` }} />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
