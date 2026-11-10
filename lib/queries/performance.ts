"use client";

import { useLocalization } from "@/lib/localization/provider";
import { localizedFormats } from "@/lib/localization/format";
import * as React from "react";
import { toDateKey, type NetWorthPeriod } from "@/lib/calc/net-worth";
import { computePortfolioReturns } from "@/lib/calc/returns";

import { PERFORMANCE_DEFAULT_PERIOD, portfolioChartRange, type PortfolioChartPeriod, type PortfolioChartRange } from "@/lib/investments/chart-period";
import type { ReturnBasis } from "@/lib/investments/view";
import { useInvestmentsView } from "./investments-view";

/** Periodo del grafico, selezione trascinata persistente e anteprima temporanea del puntatore. */
export function usePerformanceView() {
  const { locale, t } = useLocalization();
  const { formatDateWithYear } = localizedFormats(locale);
  const todayKey = React.useMemo(() => toDateKey(new Date()), []);
  // Year to date first (owner, 2026-11-03): the whole history stays one tap away, but on a long history it was slow to open.
  const [period, setPeriod] = React.useState<PortfolioChartPeriod>(PERFORMANCE_DEFAULT_PERIOD);
  const [customRange, setCustomRange] = React.useState<PortfolioChartRange>({ from: `${todayKey.slice(0, 4)}-01-01`, to: todayKey });
  const [selection, setSelection] = React.useState<PortfolioChartRange | null>(null);
  const [inspectedDate, setInspectedDate] = React.useState<string | null>(null);
  const [basis, setBasis] = React.useState<ReturnBasis>("securities");
  const calculationPeriod: NetWorthPeriod = period === "ytd" || period === "custom" ? "max" : period;
  const range = React.useMemo(() => selection ?? portfolioChartRange(period, customRange, todayKey), [selection, period, customRange, todayKey]);
  const { overview, view, today } = useInvestmentsView(calculationPeriod, true, range, basis);
  const inspected = React.useMemo(() => {
    if (!inspectedDate || !view?.returns || !overview.data) return null;
    // The view's own transactions and FX table: the daily walk up to the hovered day is a slice of the one already done.
    return computePortfolioReturns({
      transactions: view.transactions,
      fx: view.fx,
      instruments: overview.data.instruments,
      priceIndex: view.priceIndex,
      userCurrency: view.currency,
      benchmark: view.benchmark,
      inflation: view.returns.real ? overview.data.inflation : null,
      today,
      period: calculationPeriod,
      range: { from: view.returns.fromKey, to: view.returns.toKey },
      asOf: inspectedDate,
      locale,
      capital: view.returnBasis === "capital" ? view.leverage.capital : null,
    });
  }, [inspectedDate, view, overview.data, today, calculationPeriod, locale]);
  const periodLabel = view?.returns
    ? `${formatDateWithYear(view.returns.fromKey)} – ${formatDateWithYear(view.returns.toKey)}`
    : t("Nessuna operazione nell’intervallo");

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
  function changeBasis(next: ReturnBasis) {
    setBasis(next);
    setInspectedDate(null);
  }
  return { overview, view, today, todayKey, period, calculationPeriod, customRange, range, selection, basis, changeBasis,
    inspected, periodLabel, changePeriod, changeRange, selectRange, resetSelection, inspectDate: setInspectedDate };
}
