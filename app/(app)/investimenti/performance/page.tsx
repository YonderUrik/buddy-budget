"use client";

import * as React from "react";
import { BrokerComparisonCard, InvestmentsViewGate, ReturnHeatmapCard, ReturnsCard, RiskCard } from "@/components/domain/investments";
import { PortfolioPeriodSelector } from "@/components/domain/investments/portfolio-period-selector";
import { Button } from "@/components/ui/button";
import { parseDateOnly } from "@/lib/calc/expenses";
import { useBackfillStatusQuery } from "@/lib/queries/investments";
import { usePerformanceView } from "@/lib/queries/performance";

/** Rendimenti con anteprima alla data; grafico, rischio e heatmap condividono l’intervallo selezionato. */
export default function PerformancePage() {
  const performance = usePerformanceView();
  const { overview, view, today, periodLabel } = performance;
  const backfillIds = React.useMemo(() => [...new Set([
    ...(view?.instruments.map((i) => i.id) ?? []), ...(view?.benchmark ? [view.benchmark.id] : []),
  ])], [view]);
  const backfill = useBackfillStatusQuery(backfillIds);
  const benchmarkBackfill = view?.benchmark
    ? backfill.data ? (backfill.data.find((b) => b.instrumentId === view.benchmark!.id) ?? null) : backfill.isError ? null : undefined
    : null;
  const currency = view?.currency ?? "EUR";

  return <InvestmentsViewGate loading={overview.isLoading} error={overview.isError || (!overview.isLoading && !view)}
    empty={!!view && !view.hasTransactions} onRetry={() => overview.refetch()}>
    {view ? <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Periodo della performance</p>
          <p className="text-sm text-muted-foreground">{periodLabel}</p>
        </div>
        <PortfolioPeriodSelector value={performance.period} range={performance.customRange} today={performance.todayKey}
          onChange={performance.changePeriod} onRangeChange={performance.changeRange} />
      </div>
      {performance.selection ? <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 p-3">
        <p className="text-sm">Intervallo selezionato sul grafico · {periodLabel}</p>
        <Button variant="outline" size="sm" onClick={performance.resetSelection}>Torna al periodo scelto</Button>
      </div> : null}
      {view.returns ? <ReturnsCard returns={view.returns} inspected={performance.inspected}
        onInspect={performance.inspectDate} onSelectRange={performance.selectRange}
        benchmark={view.benchmark} benchmarkFirstPriceDate={view.benchmarkFirstPriceDate}
        benchmarkBackfill={benchmarkBackfill} currency={currency} />
        : <p role="status" className="rounded-lg border p-4 text-sm text-muted-foreground">Nessuna operazione nell’intervallo scelto. Seleziona un altro periodo.</p>}
      {overview.data ? <BrokerComparisonCard data={overview.data} period={performance.calculationPeriod} today={today} range={performance.range} /> : null}
      {view.analysis.risk ? <RiskCard risk={view.analysis.risk} period={performance.calculationPeriod}
        periodLabel={`Periodo del grafico · ${periodLabel}`} benchmarkName={view.benchmark?.name ?? null} currency={currency} /> : null}
      {view.returns?.daily.length ? <ReturnHeatmapCard key={`${view.returns.fromKey}:${view.returns.toKey}`}
        daily={view.returns.daily} currency={currency} today={parseDateOnly(view.returns.toKey)} periodLabel={`Periodo del grafico · ${periodLabel}`} /> : null}
    </> : null}
  </InvestmentsViewGate>;
}
