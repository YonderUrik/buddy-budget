/**
 * Card principale di Debiti: quanto resta da restituire, quando finisci e quanto costano gli interessi. Una frase
 * dice la cosa più importante, le tre cifre sotto danno il dettaglio.
 */

import { Card, CardContent } from "@/components/ui/card";
import type { DebtsOverview } from "@/lib/debts/view";
import { formatCurrency } from "@/lib/format";
import { formatMonthYear, summarySentence } from "./debts-format";

export interface DebtsSummaryCardProps {
  overview: DebtsOverview;
  currency: string;
}

export function DebtsSummaryCard({ overview, currency }: DebtsSummaryCardProps) {
  const money = (value: number) => formatCurrency(value, currency, { maximumFractionDigits: 0 });
  const stats = [
    { label: "Rata al mese", value: money(overview.monthlyPayment) },
    { label: "Interessi già pagati", value: money(overview.interestToDate) },
    { label: "Interessi ancora da pagare", value: money(overview.interestRemaining) },
  ];
  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Debito residuo</p>
          <p className="font-heading text-4xl font-medium tabular-nums text-foreground">{money(overview.totalResidual)}</p>
          <p className="text-sm text-muted-foreground">{summarySentence(overview, formatMonthYear)}</p>
        </div>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg bg-muted/50 px-3 py-2.5">
              <dt className="text-xs text-muted-foreground">{stat.label}</dt>
              <dd className="font-heading text-lg font-medium tabular-nums text-foreground">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
