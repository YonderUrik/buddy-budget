/** 4 KPI di Cash flow: Entrate medie, Uscite medie, Flusso netto totale, Tasso di risparmio. */

import { StatCard } from "@/components/domain/stat-card";
import { computeCashflowKpis, getCashflowPeriodRange, type CashflowPeriod } from "@/lib/calc/cashflow";
import type { Transaction } from "@/lib/db/schema/transactions";

export interface CashflowKpiCardsProps {
  transactions: Transaction[];
  period: CashflowPeriod;
  currency: string;
  /** Periodo che l'utente sta guardando (può essere passato o presente). */
  referenceDate: Date;
  /** Data reale corrente, per il taglio giorni-trascorsi nel calcolo delle medie — indipendente da referenceDate. */
  today: Date;
}

export function CashflowKpiCards({ transactions, period, currency, referenceDate, today }: CashflowKpiCardsProps) {
  const range = getCashflowPeriodRange(period, referenceDate);
  const kpis = computeCashflowKpis(transactions, range, today);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
      <StatCard label="Entrate medie" value={kpis.entrateMedie} currency={currency} />
      <StatCard label="Uscite medie" value={kpis.usciteMedie} currency={currency} tone="neutral" />
      <StatCard label="Flusso netto" value={kpis.flussoNettoTotale} currency={currency} />
      <StatCard
        label="Tasso di risparmio"
        value={kpis.tassoRisparmio ?? 0}
        currency={currency}
        valueOverride={kpis.tassoRisparmio === null ? "—" : `${Math.round(kpis.tassoRisparmio * 100)}%`}
        tone={kpis.tassoRisparmio === null ? "neutral" : "auto"}
        subtitle={
          kpis.tassoRisparmio === null
            ? "Non calcolabile (nessuna entrata nel periodo)"
            : "Quota delle entrate non spesa"
        }
      />
    </div>
  );
}
