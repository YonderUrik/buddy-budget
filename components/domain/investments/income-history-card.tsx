/**
 * Card "Dividendi e cedole": quanto hai incassato negli ultimi 12 mesi, il rendimento da proventi sul costo, gli
 * anni a confronto e gli strumenti che pagano di più. Importi netti, in valuta utente.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Instrument } from "@/lib/db/schema/investments";
import { formatCurrency } from "@/lib/format";
import type { IncomeHistory } from "@/lib/investments/income";

function pct(ratio: number): string {
  return `${(ratio * 100).toFixed(1).replace(".", ",")}%`;
}

export interface IncomeHistoryCardProps {
  income: IncomeHistory;
  instrumentsById: Map<string, Instrument>;
  currency: string;
}

export function IncomeHistoryCard({ income, instrumentsById, currency }: IncomeHistoryCardProps) {
  const format = (amount: number) => formatCurrency(amount, currency, { maximumFractionDigits: 0 });
  const maxYear = Math.max(...income.years.map((y) => y.amount), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dividendi e cedole</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <p className="max-w-prose text-base text-foreground">
          Negli ultimi 12 mesi hai incassato <span className="font-semibold tabular-nums text-pos">{format(income.trailing)}</span> netti
          {income.yieldOnCost !== null && income.trailing > 0 ? (
            <span className="text-muted-foreground">
              , il <span className="tabular-nums">{pct(income.yieldOnCost)}</span> di quanto hai pagato per quello che possiedi
            </span>
          ) : null}
          .<span className="text-muted-foreground"> Da sempre: {format(income.total)}.</span>
        </p>
        <div className="grid gap-6 sm:grid-cols-2">
          <ul className="flex flex-col gap-2" aria-label="Proventi per anno">
            {income.years.map((year) => (
              <li key={year.year} className="grid grid-cols-[3rem_1fr_auto] items-center gap-3 text-sm">
                <span className="tabular-nums text-muted-foreground">{year.year}</span>
                <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <span className="block h-full rounded-full bg-pos" style={{ width: `${maxYear > 0 ? (year.amount / maxYear) * 100 : 0}%` }} />
                </span>
                <span className="tabular-nums text-foreground">{format(year.amount)}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">Chi paga di più (ultimi 12 mesi)</p>
            <ul className="flex flex-col gap-1.5">
              {income.topInstruments.map((item) => (
                <li key={item.instrumentId} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate text-foreground">{instrumentsById.get(item.instrumentId)?.name ?? "Strumento"}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{format(item.trailing)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
