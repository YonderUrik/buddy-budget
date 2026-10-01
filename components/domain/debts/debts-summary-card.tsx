/**
 * Card principale di Debiti: quanto resta da restituire e di quanto è fatto di interessi. Una barra divide ciò che
 * restituirai in capitale e interessi, perché è il numero che dice davvero quanto costa il debito.
 */

import { Card, CardContent } from "@/components/ui/card";
import type { DebtsOverview } from "@/lib/debts/view";
import { formatCurrency } from "@/lib/format";
import { formatMonthYear, summarySentence } from "./debts-format";

export interface DebtsSummaryCardProps {
  overview: DebtsOverview;
  currency: string;
}

const percent = (value: number) => `${value.toFixed(2).replace(".", ",")}%`;

export function DebtsSummaryCard({ overview, currency }: DebtsSummaryCardProps) {
  const money = (value: number) => formatCurrency(value, currency, { maximumFractionDigits: 0 });
  const toRepay = overview.totalResidual + overview.interestRemaining;
  const interestShare = toRepay > 0 ? overview.interestRemaining / toRepay : 0;
  const stats = [
    { label: "Rata al mese", value: money(overview.monthlyPayment) },
    { label: "TAEG medio", value: overview.weightedApr !== null ? percent(overview.weightedApr) : "—" },
    { label: "Interessi già pagati", value: money(overview.interestToDate + overview.creditInterestToDate) },
    ...(overview.creditLineCount > 0 ? [{ label: "Interessi linee al mese", value: money(overview.creditMonthlyCost) }] : []),
  ];
  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Debito totale</p>
          <p className="font-heading text-4xl font-medium tabular-nums text-foreground">{money(overview.totalDebt)}</p>
          <p className="text-sm text-muted-foreground">{summarySentence(overview, formatMonthYear)}</p>
        </div>

        {toRepay > 0 ? (
          <div className="flex flex-col gap-2">
            <div className="flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={`Dei ${money(toRepay)} che restituirai, ${money(overview.interestRemaining)} sono interessi`}>
              <span className="h-full bg-primary" style={{ width: `${(1 - interestShare) * 100}%` }} />
              <span className="h-full bg-neg" style={{ width: `${interestShare * 100}%` }} />
            </div>
            <p className="text-sm text-foreground">
              Dei <strong className="font-medium tabular-nums">{money(toRepay)}</strong> che restituirai,{" "}
              <strong className="font-medium tabular-nums text-neg">{money(overview.interestRemaining)}</strong> sono interessi ({Math.round(interestShare * 100)}%).
            </p>
          </div>
        ) : null}

        <dl className={`grid grid-cols-1 gap-3 ${stats.length > 3 ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
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
