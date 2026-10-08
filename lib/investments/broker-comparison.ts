import type { NetWorthPeriod } from "@/lib/calc/net-worth";
import type { InvestmentData } from "./data";
import { toTransactionInputs } from "./view";
import { buildFxTable } from "@/lib/calc/fx";
import { buildPriceIndex } from "@/lib/calc/investments";
import { computePortfolioReturns } from "@/lib/calc/returns";
import { filterInvestmentBrokers, investmentBrokerGroups } from "./broker-filter";

/** Overlay TWR series on actual calendar dates, leaving absent history empty rather than inventing returns. */
export function brokerComparison(data: InvestmentData, period: NetWorthPeriod, today: Date, range?: { from: string; to: string }) {
  const groups = investmentBrokerGroups(data);
  const fx = buildFxTable(data.fxRates);
  const returnsFor = (subset: InvestmentData) => {
    const transactions = toTransactionInputs(subset);
    return computePortfolioReturns({ transactions, instruments: subset.instruments, priceIndex: buildPriceIndex(subset.prices, subset.manualPrices, transactions), fx, userCurrency: subset.currency, period, today, range });
  };
  const lines = groups.map((group, index) => {
    const isolated = filterInvestmentBrokers(data, new Set(groups.filter((g) => g.id !== group.id).map((g) => g.id)));
    return { key: `broker${index}`, label: group.label, returns: returnsFor(isolated) };
  });
  if (groups.length > 1) lines.push({ key: "combined", label: "Portafoglio combinato", returns: returnsFor(data) });
  const dates = new Map<string, { date: string; label: string; [key: string]: string | number }>();
  for (const line of lines) for (const point of line.returns?.series ?? []) {
    const row = dates.get(point.date) ?? { date: point.date, label: point.label, time: Date.parse(`${point.date}T00:00:00Z`) };
    row[line.key] = point.portfolio * 100;
    dates.set(point.date, row);
  }
  return { lines: lines.map((line) => ({ key: line.key, label: line.label, twr: line.returns?.twr ?? null })), points: [...dates.values()].sort((a, b) => a.date.localeCompare(b.date)) };
}
