/** Riga di KPI per la schermata Spese: Speso nel periodo, Budget rimanente, Media giornaliera. */

import { StatCard } from "@/components/domain/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { computeKpis, type ExpensePeriod } from "@/lib/calc/expenses";
import type { Transaction } from "@/lib/db/schema/transactions";
import type { Budget } from "@/lib/db/schema/budgets";

export interface ExpensesKpiCardsProps {
  transactions: Transaction[];
  budgets: Budget[];
  period: ExpensePeriod;
  currency: string;
  /** Data di riferimento per il calcolo (default: adesso). */
  referenceDate?: Date;
}

export function ExpensesKpiCards({
  transactions,
  budgets,
  period,
  currency,
  referenceDate = new Date(),
}: ExpensesKpiCardsProps) {
  const kpis = computeKpis(transactions, budgets, period, referenceDate);
  const trendLabel =
    kpis.mediaGiornaliera <= kpis.mediaGiornalieraPeriodoPrecedente
      ? "In calo rispetto al periodo precedente"
      : "In aumento rispetto al periodo precedente";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard label="Speso nel periodo" value={-kpis.speso} currency={currency} />
      <StatCard
        label="Budget rimanente"
        value={kpis.budgetRimanente}
        currency={currency}
        subtitle={`${kpis.giorniRimasti} giorni rimasti`}
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Media giornaliera
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-heading text-3xl font-medium tabular-nums">
            {formatCurrency(kpis.mediaGiornaliera, currency)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{trendLabel}</p>
        </CardContent>
      </Card>
    </div>
  );
}
