"use client";
import { useLocalization } from "@/lib/localization/provider";

import * as React from "react";
import { BrokerSelector, InvestmentsViewGate, ReturnBasisToggle, ReturnHeatmapCard, ReturnsCard, RiskCard } from "@/components/domain/investments";
import { track } from "@/lib/analytics";
import { PortfolioPeriodSelector } from "@/components/domain/investments/portfolio-period-selector";
import { Button } from "@/components/ui/button";
import { parseDateOnly } from "@/lib/calc/expenses";
import { INVESTMENTS_DEFAULT_PERIOD } from "@/lib/investments/labels";
import { useBackfillStatusQuery, useInvestmentsOverviewQuery } from "@/lib/queries/investments";
import { usePerformanceView } from "@/lib/queries/performance";

/** Filled card around each block of the page. */
const CARD = "rounded-2xl bg-card p-4 sm:p-6";

/**
 * Performance, «chart first» (design option 2, 2026-10-31): the period is stated once at the top; the returns card
 * holds the controls, the chart and the figures; risk and the heatmap follow, each in its own card. Chart, risk and
 * heatmap share the selected range.
 */
export default function PerformancePage() {
  const { t: tr } = useLocalization();
  const performance = usePerformanceView();
  const { overview, view, periodLabel } = performance;
  // The broker filter lists every broker, so it reads the unfiltered overview (the query the layout already loads).
  const allBrokers = useInvestmentsOverviewQuery(INVESTMENTS_DEFAULT_PERIOD).data;
  const backfillIds = React.useMemo(() => [...new Set([
    ...(view?.instruments.map((i) => i.id) ?? []), ...(view?.benchmark ? [view.benchmark.id] : []),
  ])], [view]);
  const backfill = useBackfillStatusQuery(backfillIds);
  const benchmarkBackfill = view?.benchmark
    ? backfill.data ? (backfill.data.find((b) => b.instrumentId === view.benchmark!.id) ?? null) : backfill.isError ? null : undefined
    : null;
  const currency = view?.currency ?? "EUR";
  const controls = <>
    {view?.leverage.capital && view.leverage.accounts.length ? <ReturnBasisToggle value={view.returnBasis} onChange={(next) => {
      performance.changeBasis(next);
      track("investment_return_basis_changed", { basis: next === "capital" ? "capitale" : "titoli" });
    }} /> : null}
    {allBrokers ? <BrokerSelector data={allBrokers} /> : null}
    <PortfolioPeriodSelector value={performance.period} range={performance.customRange} today={performance.todayKey}
      onChange={performance.changePeriod} onRangeChange={performance.changeRange} surface="performance" showRangeCaption={false} />
  </>;

  return <InvestmentsViewGate loading={overview.isLoading} error={overview.isError || (!overview.isLoading && !view)}
    empty={!!view && !view.hasTransactions} onRetry={() => overview.refetch()}>
    {view ? <div className="flex min-w-0 flex-col gap-5">
      <p className="text-sm text-muted-foreground">{periodLabel}{" · "}{tr("importi in {0}", { 0: currency })}</p>
      {performance.selection ? <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 p-3">
        <p className="text-sm">{tr("Intervallo selezionato sul grafico ·")}{" "}{periodLabel}</p>
        <Button variant="outline" size="sm" onClick={performance.resetSelection}>{tr("Torna al periodo scelto")}</Button>
      </div> : null}
      {view.returns ? <ReturnsCard returns={view.returns} inspected={performance.inspected}
        onInspect={performance.inspectDate} onSelectRange={performance.selectRange}
        benchmark={view.benchmark} benchmarkFirstPriceDate={view.benchmarkFirstPriceDate}
        benchmarkBackfill={benchmarkBackfill} currency={currency} controls={controls} basis={view.returnBasis} />
        : <div className={`flex flex-col gap-3 ${CARD}`}>
          <div className="flex flex-wrap justify-end gap-2">{controls}</div>
          <p role="status" className="text-sm text-muted-foreground">{tr("Nessuna operazione nell’intervallo scelto. Seleziona un altro periodo.")}</p>
        </div>}
      {view.analysis.risk ? <div className={CARD}><RiskCard risk={view.analysis.risk} period={performance.calculationPeriod}
        periodLabel={null} benchmarkName={view.benchmark?.name ?? null} currency={currency} /></div> : null}
      {view.returns?.daily.length ? <div className={CARD}><ReturnHeatmapCard key={`${view.returns.fromKey}:${view.returns.toKey}`}
        daily={view.returns.daily} currency={currency} today={parseDateOnly(view.returns.toKey)} /></div> : null}
    </div> : null}
  </InvestmentsViewGate>;
}
