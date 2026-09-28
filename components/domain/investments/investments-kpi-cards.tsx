/** Tre KPI della pagina Investimenti: valore del portafoglio, guadagno totale, investito netto con PAC mensile. */

import { StatCard } from "@/components/domain/stat-card";
import type { PortfolioSummary } from "@/lib/calc/investments";
import { formatCurrency } from "@/lib/format";

export interface InvestmentsKpiCardsProps {
  summary: PortfolioSummary;
  /** Importo mensile equivalente dei PAC attivi; 0 = nessun PAC. */
  monthlyPlanAmount: number;
  currency: string;
}

function formatPct(ratio: number): string {
  const sign = ratio < 0 ? "−" : "+";
  return `${sign}${Math.abs(ratio * 100).toFixed(2).replace(".", ",")}%`;
}

function signedCurrency(value: number, currency: string): string {
  return `${value < 0 ? "−" : "+"}${formatCurrency(Math.abs(value), currency, { maximumFractionDigits: 0 })}`;
}

export function InvestmentsKpiCards({ summary, monthlyPlanAmount, currency }: InvestmentsKpiCardsProps) {
  const dayChange =
    summary.dayChange !== null && summary.dayChangePct !== null
      ? `${signedCurrency(summary.dayChange, currency)} (${formatPct(summary.dayChangePct)}) dall'ultima chiusura`
      : "Variazione disponibile dal secondo prezzo";
  const unpriced =
    summary.unpricedCount > 0
      ? ` · ${summary.unpricedCount} ${summary.unpricedCount === 1 ? "strumento" : "strumenti"} senza prezzo`
      : "";
  const gainSubtitle =
    summary.totalGainPct !== null ? `${formatPct(summary.totalGainPct)} sugli acquisti, dividendi inclusi` : undefined;
  const planSubtitle =
    monthlyPlanAmount > 0
      ? `PAC: ${formatCurrency(monthlyPlanAmount, currency, { maximumFractionDigits: 0 })} al mese`
      : "Nessun PAC attivo";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard label="Valore" value={summary.totalValue} currency={currency} tone="neutral" subtitle={dayChange + unpriced} />
      <StatCard
        label="Guadagno totale"
        value={summary.totalGain}
        currency={currency}
        valueOverride={signedCurrency(summary.totalGain, currency)}
        subtitle={gainSubtitle}
      />
      <StatCard label="Investito netto" value={summary.investedNet} currency={currency} tone="neutral" subtitle={planSubtitle} />
    </div>
  );
}
