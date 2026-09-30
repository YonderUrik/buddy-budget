/** Barra e legenda della spesa del periodo divisa per gruppo, in cima alla vista "Dettaglio". */

import { formatCurrency } from "@/lib/format";

export interface SpendSummaryItem {
  key: string;
  label: string;
  /** Token CSS del colore del gruppo (es. `var(--group-dovuta)`). */
  colorVar: string;
  amount: number;
}

export interface CategorySpendSummaryProps {
  items: SpendSummaryItem[];
  currency: string;
}

export function CategorySpendSummary({ items, currency }: CategorySpendSummaryProps) {
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  if (total <= 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label="Spesa del mese per gruppo">
        {items.filter((item) => item.amount > 0).map((item) => (
          <span key={item.key} style={{ flex: item.amount, backgroundColor: item.colorVar }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item.key} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: item.colorVar }} />
            {item.label}
            <b className="font-semibold text-foreground tabular-nums">{formatCurrency(item.amount, currency, { maximumFractionDigits: 0 })}</b>
            <span className="tabular-nums">{Math.round((item.amount / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
