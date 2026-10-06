import { computeTaxReport, type TaxReport } from "@/lib/calc/taxes";
import type { InvestmentTransactionInput } from "@/lib/calc/investments";
import type { InvestmentData } from "./data";
import { toTaxInstruments } from "./tax-settings";

/** Single tax calculation shared by the Taxes tab and portfolio simulations, including settings and loss carryforwards. */
export function investmentTaxReport(data: InvestmentData, transactions: InvestmentTransactionInput[], todayKey: string): TaxReport {
  return computeTaxReport({ transactions, instruments: toTaxInstruments(data.instruments, data.instrumentSettings),
    regime: data.portfolios[0]?.taxRegime ?? "amministrato",
    manualLosses: data.taxCarryforwards.map((c) => ({ year: c.year, amount: Number(c.amount) })), todayKey });
}

/** Additional annual liability, net of recorded withholding, dated consistently for the performance simulation. */
export function estimatedTaxCharges(report: TaxReport, todayKey: string): { date: string; amount: number }[] {
  return report.years.flatMap((year) => {
    const remaining = Math.max(0, year.estimatedTax - year.withheld);
    if (remaining < 0.000001) return [];
    const events = report.realized.filter((event) => event.year === year.year);
    // Annual regimes/crypto need the year's complete netting: accrue at year end (today for the open year).
    if (report.regime === "dichiarativo" || events.some((event) => event.category === "crypto")) {
      return [{ date: `${year.year}-12-31` < todayKey ? `${year.year}-12-31` : todayKey, amount: remaining }];
    }
    const dated = events.map((event) => ({ date: event.date, amount: Math.max(0, (event.estimatedTax ?? 0) - event.withheld) }));
    const total = dated.reduce((sum, event) => sum + event.amount, 0);
    return total > 0 ? dated.filter((event) => event.amount > 0).map((event) => ({ ...event, amount: event.amount * remaining / total })) : [];
  });
}
