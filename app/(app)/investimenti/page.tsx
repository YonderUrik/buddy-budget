"use client";


/**
 * Portafoglio tab of Investimenti, the most essential one: what it is worth and what it earned, and the positions (with
 * the security search and the watched ones). Performance, diversification, income, taxes and operations have their own
 * tabs; title, tabs and the register and import dialogs live in the layout.
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
import { PAGE_SPLIT, PAGE_SPLIT_MAIN, PAGE_SPLIT_SIDE } from "@/components/domain/shared";

export default function InvestimentiPage() {

  const [includeFees, setIncludeFees] = React.useState(true);
  const [includeTaxes, setIncludeTaxes] = React.useState(true);
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
              periodGain={view.periodGain}
              includeFees={includeFees}
              includeTaxes={includeTaxes}
              onIncludeFeesChange={(value) => { setIncludeFees(value); track("investment_reinvest_toggled", { kind: "costi", reinvested: !value }); }}
              onIncludeTaxesChange={(value) => { setIncludeTaxes(value); track("investment_reinvest_toggled", { kind: "imposte", reinvested: !value }); }}
              cash={cash}
              summary={view.summary}
              breakdown={computeValueBreakdown(view.summary)}
              series={view.series}
              period={period}
              onPeriodChange={(value) => { setPeriod(value); track("investment_chart_period_changed", { period: value }); }}
              range={customRange}
              today={todayKey}
              onRangeChange={setCustomRange}
              currency={currency}
            />
            <div className={PAGE_SPLIT}>
              <div className={PAGE_SPLIT_MAIN}>
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
                      suggestions={view.heldInstruments}
                      onSelect={(instrument) => track("investment_title_searched", { type: instrument.type })}
                    />
                  }
                />
                <WatchedTitlesSection />
              </div>
              <div className={PAGE_SPLIT_SIDE}>
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
