/** Riga di KPI per la schermata Spese: Speso nel periodo, Budget rimanente, Media giornaliera. */

import { StatCard } from "@/components/domain/stat-card";
import { computeKpis, type ExpensePeriod } from "@/lib/calc/expenses";
import type { Transaction } from "@/lib/db/schema/transactions";
import type { Budget } from "@/lib/db/schema/budgets";

export interface ExpensesKpiCardsProps {
  transactions: Transaction[];
  budgets: Budget[];
  period: ExpensePeriod;
  currency: string;
  /** Periodo che l'utente sta guardando (può essere passato o presente). */
  referenceDate: Date;
  /** Data reale corrente, per il taglio giorni-trascorsi — indipendente da referenceDate. */
  today: Date;
}

export function ExpensesKpiCards({
  transactions,
  budgets,
  period,
  currency,
  referenceDate,
  today,
}: ExpensesKpiCardsProps) {
  const kpis = computeKpis(transactions, budgets, period, referenceDate, today);
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
      <StatCard
        label="Media giornaliera"
        value={-kpis.mediaGiornaliera}
        currency={currency}
        subtitle={trendLabel}
      />
    </div>
  );
}
