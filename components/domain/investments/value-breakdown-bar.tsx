/**
 * Barra che scompone il valore del portafoglio: quanto hai pagato per ciò che possiedi e quanto ha aggiunto il
 * mercato (in verde). In perdita la barra è lunga quanto il pagato, e la parte persa è in rosso.
 */

import type { ValueBreakdown } from "@/lib/investments/insights";
import { formatCurrency } from "@/lib/format";

export interface ValueBreakdownBarProps {
  breakdown: ValueBreakdown;
  currency: string;
}

function pct(part: number, whole: number): string {
  return whole > 0 ? `${Math.max((part / whole) * 100, 0)}%` : "0%";
}

export function ValueBreakdownBar({ breakdown, currency }: ValueBreakdownBarProps) {
  const { paid, market, value } = breakdown;
  const gaining = market >= 0;
  // In guadagno il totale è il valore; in perdita è il pagato (la parte rossa è ciò che manca per tornarci).
  const whole = gaining ? value : paid;
  const format = (amount: number) => formatCurrency(amount, currency, { maximumFractionDigits: 0 });

  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`Hai pagato ${format(paid)}, il mercato ha ${gaining ? "aggiunto" : "tolto"} ${format(Math.abs(market))}`}
      >
        <div className="h-full bg-primary" style={{ width: pct(gaining ? paid : value, whole) }} />
        <div className={gaining ? "h-full bg-pos" : "h-full bg-neg/70"} style={{ width: pct(Math.abs(market), whole) }} />
      </div>
      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
          {gaining ? "Pagato" : "Vale oggi"}{" "}
          <span className="font-medium tabular-nums text-foreground">{format(gaining ? paid : value)}</span>
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className={gaining ? "size-2 rounded-full bg-pos" : "size-2 rounded-full bg-neg/70"} aria-hidden="true" />
          {gaining ? "Dal mercato" : "Perso"}{" "}
          <span className={gaining ? "font-medium tabular-nums text-pos" : "font-medium tabular-nums text-neg"}>
            {gaining ? "+" : "−"}
            {format(Math.abs(market))}
          </span>
        </span>
      </div>
    </div>
  );
}
