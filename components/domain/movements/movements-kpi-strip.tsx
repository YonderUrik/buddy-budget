"use client";

/** Le quattro cifre del periodo in Analisi: entrate, uscite, netto e quota risparmiata, con il confronto sul periodo prima. */

import { StatCard } from "@/components/domain/stat-card";
import {
  computeIncomeSummary,
  computeSummary,
  formatPeriodLabel,
  getPeriodRange,
  getPreviousPeriodRange,
  type ExpensePeriod,
} from "@/lib/calc/expenses";
import { computeSavingsRate } from "@/lib/calc/movements";
import { formatCurrency } from "@/lib/format";
import type { Transaction } from "@/lib/db/schema/transactions";

export interface MovementsKpiStripProps {
  transactions: Transaction[];
  period: ExpensePeriod;
  referenceDate: Date;
  currency: string;
}

function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function MovementsKpiStrip({ transactions, period, referenceDate, currency }: MovementsKpiStripProps) {
  const range = getPeriodRange(period, referenceDate);
  const previousRange = getPreviousPeriodRange(period, referenceDate);
  const income = computeIncomeSummary(transactions, range).entrateEffettive;
  const expenses = computeSummary(transactions, range).speseEffettive;
  const net = income - expenses;
  const previousNet =
    computeIncomeSummary(transactions, previousRange).entrateEffettive -
    computeSummary(transactions, previousRange).speseEffettive;
  const rate = computeSavingsRate(income, expenses);

  const netDelta = net - previousNet;
  const netSubtitle =
    netDelta === 0
      ? `Come ${formatPeriodLabel(period, previousRange)}`
      : `${netDelta > 0 ? "+" : "−"}${formatCurrency(Math.abs(netDelta), currency, { maximumFractionDigits: 0 })} su ${formatPeriodLabel(period, previousRange)}`;

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <StatCard label="Entrate" value={income} currency={currency} tone="pos" />
      <StatCard label="Uscite" value={expenses} currency={currency} tone="neutral" />
      <StatCard label="Netto" value={net} currency={currency} subtitle={netSubtitle} />
      <StatCard
        label="Risparmio"
        value={rate ?? 0}
        tone={rate === null ? "neutral" : "auto"}
        valueOverride={rate === null ? "—" : formatPercent(rate)}
        subtitle={rate === null ? "Nessuna entrata nel periodo" : "delle entrate"}
      />
    </div>
  );
}
