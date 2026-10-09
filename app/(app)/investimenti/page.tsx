"use client";

/**
 * Scheda Portafoglio di Investimenti, la più essenziale: quanto vale e quanto ha guadagnato, e le posizioni (con la ricerca di un titolo e quelli seguiti).
 * Performance, diversificazione, proventi, tasse e operazioni hanno le loro schede; titolo, schede e dialog
 * "Registra"/"Importa" sono nel layout.
 */

import { track } from "@/lib/analytics";
import { portfolioChartRange, type PortfolioChartPeriod, type PortfolioChartRange } from "@/lib/investments/chart-period";
import * as React from "react";
import {
  CostDetailsCard,
  DividendsSummaryCard,
  InvestmentsViewGate,
  ManualPriceDialog,
  PortfolioHeroCard,
  PositionsList,
  TitleSearch,
  WatchedTitlesSection,
} from "@/components/domain/investments";
import { toDateKey } from "@/lib/calc/net-worth";
import type { Instrument } from "@/lib/db/schema/investments";
import { computeConcentration, computeValueBreakdown } from "@/lib/investments/insights";
import { INVESTMENTS_DEFAULT_PERIOD } from "@/lib/investments/labels";
import { useBackfillStatusQuery } from "@/lib/queries/investments";
import { useInvestmentsView } from "@/lib/queries/investments-view";

export default function InvestimentiPage() {
  const [includeFees, setIncludeFees] = React.useState(true);
  const [includeTaxes, setIncludeTaxes] = React.useState(true);
  const [includeCash, setIncludeCash] = React.useState(true);
  const [period, setPeriod] = React.useState<PortfolioChartPeriod>(INVESTMENTS_DEFAULT_PERIOD);
  const [todayKey] = React.useState(() => toDateKey(new Date()));
  const [customRange, setCustomRange] = React.useState<PortfolioChartRange>({ from: `${todayKey.slice(0, 4)}-01-01`, to: todayKey });
  const chartRange = React.useMemo(() => portfolioChartRange(period, customRange, todayKey), [period, customRange, todayKey]);
  const { overview, view, today } = useInvestmentsView(period === "ytd" || period === "custom" ? "max" : period, true, chartRange);
  const instrumentIds = React.useMemo(() => view?.instruments.map((i) => i.id) ?? [], [view]);
  const backfill = useBackfillStatusQuery(instrumentIds);
  const [priceInstrument, setPriceInstrument] = React.useState<Instrument | null>(null);
  const cash = overview.data?.brokerCash ?? [];
  const currency = view?.currency ?? "EUR";

  return (
    <>
      <InvestmentsViewGate
        loading={overview.isLoading}
        error={overview.isError || (!overview.isLoading && !view)}
        empty={!!view && !view.hasTransactions && !cash.length}
        onRetry={() => overview.refetch()}
      >
        {view ? (
          <>
            <PortfolioHeroCard
              costImpact={view.costImpact}
              includeFees={includeFees}
              includeTaxes={includeTaxes}
              onIncludeFeesChange={setIncludeFees}
              onIncludeTaxesChange={setIncludeTaxes}
              cash={cash}
              includeCash={includeCash}
              onIncludeCashChange={setIncludeCash}
              summary={view.summary}
              breakdown={computeValueBreakdown(view.summary)}
              series={view.series}
              period={period}
              onPeriodChange={(value) => { setPeriod(value); track("investment_chart_period_changed", { period: value }); }}
              range={customRange}
              today={todayKey}
              onRangeChange={(range) => { setCustomRange(range); track("investment_chart_period_changed", { period: "custom" }); }}
              currency={currency}
            />
            <div className="grid grid-cols-1 gap-x-10 gap-y-10 lg:grid-cols-5">
              <div className="flex flex-col gap-10 lg:col-span-3">
                <PositionsList
                  rows={view.summary.rows}
                  concentration={computeConcentration(view.summary.rows)}
                  currency={currency}
                  todayKey={toDateKey(today)}
                  backfill={backfill.data ?? []}
                  onManualPrice={(row) => setPriceInstrument(view.instrumentsById.get(row.instrument.id) ?? null)}
                  action={
                    <TitleSearch
                      currency={currency}
                      suggestions={view.instruments}
                      onSelect={(instrument) => track("investment_title_searched", { type: instrument.type })}
                    />
                  }
                />
                <WatchedTitlesSection />
              </div>
              <div className="flex flex-col gap-10 lg:col-span-2">
                <DividendsSummaryCard income={view.income} currency={currency} />
                <CostDetailsCard impact={view.costImpact} currency={currency} />
              </div>
            </div>
          </>
        ) : null}
      </InvestmentsViewGate>
      <ManualPriceDialog instrument={priceInstrument} onClose={() => setPriceInstrument(null)} />
    </>
  );
}
