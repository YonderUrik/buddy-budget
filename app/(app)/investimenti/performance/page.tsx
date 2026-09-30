"use client";

/**
 * Scheda Performance di Investimenti: quanto sta rendendo (TWR, money-weighted, reale, confronto con un indice),
 * quanto rischia e il rendimento nel tempo (heatmap su tutto lo storico).
 */

import * as React from "react";
import { InvestmentsViewGate, ReturnHeatmapCard, ReturnsCard, RiskCard } from "@/components/domain/investments";
import { NetWorthPeriodSelector } from "@/components/domain/net-worth";
import type { NetWorthPeriod } from "@/lib/calc/net-worth";
import { INVESTMENTS_DEFAULT_PERIOD } from "@/lib/investments/labels";
import { historyDailyReturns } from "@/lib/investments/return-heatmap-view";
import { useBackfillStatusQuery, useInvestmentsOverviewQuery } from "@/lib/queries/investments";
import { useInvestmentsView } from "@/lib/queries/investments-view";

export default function PerformancePage() {
  const [period, setPeriod] = React.useState<NetWorthPeriod>(INVESTMENTS_DEFAULT_PERIOD);
  const { overview, view, today } = useInvestmentsView(period);
  // La heatmap copre tutto lo storico: usa i dati del periodo "max" (stessa cache se il periodo è già Max).
  const fullHistory = useInvestmentsOverviewQuery("max");
  const historyReturns = React.useMemo(() => (fullHistory.data ? historyDailyReturns(fullHistory.data, today) : null), [fullHistory.data, today]);
  // Il benchmark: il suo storico si scarica quando lo si sceglie, e a fine recupero la pagina si aggiorna.
  const backfillIds = React.useMemo(
    () => [...(view?.instruments.map((i) => i.id) ?? []), ...(view?.benchmark ? [view.benchmark.id] : [])],
    [view]
  );
  const backfill = useBackfillStatusQuery(backfillIds);
  const benchmarkBackfill = view?.benchmark
    ? backfill.data
      ? (backfill.data.find((b) => b.instrumentId === view.benchmark!.id) ?? null)
      : backfill.isError
        ? null
        : undefined
    : null;
  const currency = view?.currency ?? "EUR";

  return (
    <InvestmentsViewGate
      loading={overview.isLoading}
      error={overview.isError || (!overview.isLoading && !view)}
      empty={!!view && !view.hasTransactions}
      onRetry={() => overview.refetch()}
    >
      {view ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">Rendimento e rischio nel periodo</p>
            <NetWorthPeriodSelector value={period} onChange={setPeriod} />
          </div>
          {view.returns ? (
            <ReturnsCard
              returns={view.returns}
              period={period}
              benchmark={view.benchmark}
              benchmarkFirstPriceDate={view.benchmarkFirstPriceDate}
              benchmarkBackfill={benchmarkBackfill}
              currency={currency}
            />
          ) : null}
          {view.analysis.risk ? (
            <RiskCard risk={view.analysis.risk} period={period} benchmarkName={view.benchmark?.name ?? null} currency={currency} />
          ) : null}
          {historyReturns && historyReturns.length > 0 ? <ReturnHeatmapCard daily={historyReturns} currency={currency} today={today} /> : null}
        </>
      ) : null}
    </InvestmentsViewGate>
  );
}
