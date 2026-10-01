/** "Quando finiscono": una barra per finanziamento da oggi all'ultima rata, con la rata che si libera a fine debito. */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DebtTimeline } from "@/lib/debts/timeline";
import { formatCurrency } from "@/lib/format";
import { formatMonthYear } from "./debts-format";

export interface DebtsTimelineCardProps {
  timeline: DebtTimeline | null;
  currency: string;
}

export function DebtsTimelineCard({ timeline, currency }: DebtsTimelineCardProps) {
  if (!timeline) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quando finiscono</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex flex-col gap-3.5">
          {timeline.bars.map((bar) => (
            <li key={bar.debtId} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-medium text-foreground">{bar.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  finisce a <span className="font-medium text-foreground">{formatMonthYear(bar.endDate)}</span> · libera{" "}
                  {formatCurrency(bar.installment, currency, { maximumFractionDigits: 0 })}/mese
                </span>
              </div>
              <div className="relative h-2.5 rounded-full bg-muted" role="img" aria-label={`${bar.name}: finisce a ${formatMonthYear(bar.endDate)}`}>
                <span className="absolute inset-y-0 rounded-full bg-primary" style={{ left: `${bar.startPct}%`, width: `${bar.widthPct}%` }} />
              </div>
            </li>
          ))}
        </ul>
        <div className="relative h-5 border-t text-[11px] text-muted-foreground" aria-hidden="true">
          <span className="absolute left-0 top-1">Oggi</span>
          {timeline.ticks.map((tick) => (
            <span key={tick.date} className="absolute top-1 -translate-x-1/2" style={{ left: `${tick.pct}%` }}>
              {tick.date.slice(0, 4)}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
