"use client";
import { useLocalization } from "@/lib/localization/provider";

import * as React from "react";
import { InvestmentsViewGate, ReturnHeatmapCard, ReturnsCard, RiskCard } from "@/components/domain/investments";
import { PortfolioPeriodSelector } from "@/components/domain/investments/portfolio-period-selector";
import { Button } from "@/components/ui/button";
import { parseDateOnly } from "@/lib/calc/expenses";
import { useBackfillStatusQuery } from "@/lib/queries/investments";
import { usePerformanceView } from "@/lib/queries/performance";

/** Rendimenti con anteprima alla data; grafico, rischio e heatmap condividono l’intervallo selezionato. */
export default function PerformancePage() {
  const { t: tr } = useLocalization();
  const performance = usePerformanceView();
  const { overview, view, periodLabel } = performance;
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
    {view ? <div className="flex min-w-0 flex-col gap-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{tr("Periodo della performance")}</p>
          <p className="text-sm text-muted-foreground">{periodLabel}</p>
        </div>
        <PortfolioPeriodSelector value={performance.period} range={performance.customRange} today={performance.todayKey}
          onChange={performance.changePeriod} onRangeChange={performance.changeRange} />
      </div>
      {performance.selection ? <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 p-3">
        <p className="text-sm">{tr("Intervallo selezionato sul grafico ·")}{" "}{periodLabel}</p>
        <Button variant="outline" size="sm" onClick={performance.resetSelection}>{tr("Torna al periodo scelto")}</Button>
      </div> : null}
      <div className="grid min-w-0 grid-cols-1 gap-10 lg:grid-cols-5">
      <div className="min-w-0 lg:col-span-3">
      {view.returns ? <ReturnsCard returns={view.returns} inspected={performance.inspected}
        onInspect={performance.inspectDate} onSelectRange={performance.selectRange}
        benchmark={view.benchmark} benchmarkFirstPriceDate={view.benchmarkFirstPriceDate}
        benchmarkBackfill={benchmarkBackfill} currency={currency} />
        : <p role="status" className="rounded-lg border p-4 text-sm text-muted-foreground">{tr("Nessuna operazione nell’intervallo scelto. Seleziona un altro periodo.")}</p>}
      </div>
      <div className="min-w-0 lg:col-span-2">
      {view.analysis.risk ? <RiskCard risk={view.analysis.risk} period={performance.calculationPeriod}
        periodLabel={tr("Periodo del grafico · {0}", {0: periodLabel})} benchmarkName={view.benchmark?.name ?? null} currency={currency} /> : null}
      </div>
      </div>
      {view.returns?.daily.length ? <ReturnHeatmapCard key={`${view.returns.fromKey}:${view.returns.toKey}`}
        daily={view.returns.daily} currency={currency} today={parseDateOnly(view.returns.toKey)} periodLabel={tr("Periodo del grafico · {0}", {0: periodLabel})} /> : null}
    </div> : null}
  </InvestmentsViewGate>;
}
