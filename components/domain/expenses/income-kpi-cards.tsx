/** Riga di KPI per le entrate nella schermata Transazioni: Entrate nel periodo, Media giornaliera. */

import { StatCard } from "@/components/domain/stat-card";
import {
  computeIncomeKpis,
  formatPeriodLabel,
  getPreviousPeriodRange,
  type ExpensePeriod,
} from "@/lib/calc/expenses";
import { formatCurrency } from "@/lib/format";
import type { Transaction } from "@/lib/db/schema/transactions";

export interface IncomeKpiCardsProps {
  transactions: Transaction[];
  period: ExpensePeriod;
  currency: string;
  /** Periodo che l'utente sta guardando (può essere passato o presente). */
  referenceDate: Date;
  /** Data reale corrente, per il taglio giorni-trascorsi — indipendente da referenceDate. */
  today: Date;
}

export function IncomeKpiCards({ transactions, period, currency, referenceDate, today }: IncomeKpiCardsProps) {
  const kpis = computeIncomeKpis(transactions, period, referenceDate, today);
  const previousRange = getPreviousPeriodRange(period, referenceDate);
  const previousLabel = formatPeriodLabel(period, previousRange);
  const delta = kpis.mediaGiornaliera - kpis.mediaGiornalieraPeriodoPrecedente;
  const deltaText = formatCurrency(Math.abs(delta), currency, { maximumFractionDigits: 2 });
  const percentText =
    kpis.mediaGiornalieraPeriodoPrecedente > 0
      ? ` (${Math.round((Math.abs(delta) / kpis.mediaGiornalieraPeriodoPrecedente) * 100)}%)`
      : "";
  const trendLabel =
    delta === 0
      ? `Invariata rispetto a ${previousLabel}`
      : delta < 0
        ? `In calo di ${deltaText}${percentText} rispetto a ${previousLabel}`
        : `In aumento di ${deltaText}${percentText} rispetto a ${previousLabel}`;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <StatCard label="Entrate nel periodo" value={kpis.entrate} currency={currency} />
      <StatCard label="Media giornaliera" value={kpis.mediaGiornaliera} currency={currency} subtitle={trendLabel} />
    </div>
  );
}
