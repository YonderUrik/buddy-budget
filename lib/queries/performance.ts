"use client";

import * as React from "react";
import { buildFxTable } from "@/lib/calc/fx";
import { toDateKey, type NetWorthPeriod } from "@/lib/calc/net-worth";
import { computePortfolioReturns } from "@/lib/calc/returns";
import { formatDateWithYear } from "@/lib/format";
import { portfolioChartRange, type PortfolioChartPeriod, type PortfolioChartRange } from "@/lib/investments/chart-period";
import { toTransactionInputs } from "@/lib/investments/view";
import { useInvestmentsView } from "./investments-view";

/** Periodo del grafico, selezione trascinata persistente e anteprima temporanea del puntatore. */
export function usePerformanceView() {
  const todayKey = React.useMemo(() => toDateKey(new Date()), []);
  const [period, setPeriod] = React.useState<PortfolioChartPeriod>("3mesi");
  const [customRange, setCustomRange] = React.useState<PortfolioChartRange>({ from: `${todayKey.slice(0, 4)}-01-01`, to: todayKey });
  const [selection, setSelection] = React.useState<PortfolioChartRange | null>(null);
  const [inspectedDate, setInspectedDate] = React.useState<string | null>(null);
  const calculationPeriod: NetWorthPeriod = period === "ytd" || period === "custom" ? "max" : period;
  const range = React.useMemo(() => selection ?? portfolioChartRange(period, customRange, todayKey), [selection, period, customRange, todayKey]);
  const { overview, view, today } = useInvestmentsView(calculationPeriod, true, range);
  const inputs = React.useMemo(() => overview.data ? {
    transactions: toTransactionInputs(overview.data),
    fx: buildFxTable(overview.data.fxRates),
  } : null, [overview.data]);
  const inspected = React.useMemo(() => {
    if (!inspectedDate || !view?.returns || !overview.data || !inputs) return null;
    return computePortfolioReturns({
      ...inputs,
      instruments: overview.data.instruments,
      priceIndex: view.priceIndex,
      userCurrency: view.currency,
      benchmark: view.benchmark,
      inflation: view.returns.real ? overview.data.inflation : null,
      today,
      period: calculationPeriod,
      range: { from: view.returns.fromKey, to: view.returns.toKey },
      asOf: inspectedDate,
    });
  }, [inspectedDate, view, overview.data, inputs, today, calculationPeriod]);
  const periodLabel = view?.returns
    ? `${formatDateWithYear(view.returns.fromKey)} – ${formatDateWithYear(view.returns.toKey)}`
    : "Nessuna operazione nell’intervallo";

  function changePeriod(next: PortfolioChartPeriod) {
    setPeriod(next);
    setSelection(null);
    setInspectedDate(null);
  }
  function changeRange(next: PortfolioChartRange) {
    setCustomRange(next);
    setSelection(null);
    setInspectedDate(null);
  }
  function selectRange(next: PortfolioChartRange) {
    setSelection(next);
    setInspectedDate(null);
  }
  function resetSelection() {
    setSelection(null);
    setInspectedDate(null);
  }
  return { overview, view, today, todayKey, period, calculationPeriod, customRange, range, selection,
    inspected, periodLabel, changePeriod, changeRange, selectRange, resetSelection, inspectDate: setInspectedDate };
}
