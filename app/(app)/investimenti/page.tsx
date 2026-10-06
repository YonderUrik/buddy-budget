"use client";

/**
 * Scheda Portafoglio di Investimenti, la più essenziale: quanto vale e quanto ha guadagnato, e le posizioni.
 * Performance, diversificazione, proventi, tasse e operazioni hanno le loro schede; titolo, schede e dialog
 * "Registra"/"Importa" sono nel layout.
 */

import * as React from "react";
import {
  CostDetailsCard,
  InvestmentsViewGate,
  ManualPriceDialog,
  PortfolioHeroCard,
  PositionsList,
} from "@/components/domain/investments";
import { toDateKey, type NetWorthPeriod } from "@/lib/calc/net-worth";
import type { Instrument } from "@/lib/db/schema/investments";
import { computeConcentration, computeValueBreakdown } from "@/lib/investments/insights";
import { INVESTMENTS_DEFAULT_PERIOD } from "@/lib/investments/labels";
import { useBackfillStatusQuery } from "@/lib/queries/investments";
import { useInvestmentsView } from "@/lib/queries/investments-view";

export default function InvestimentiPage() {
  const [includeFees, setIncludeFees] = React.useState(true);
  const [includeTaxes, setIncludeTaxes] = React.useState(true);
  const [period, setPeriod] = React.useState<NetWorthPeriod>(INVESTMENTS_DEFAULT_PERIOD);
  const { overview, view, today } = useInvestmentsView(period, true);
  const instrumentIds = React.useMemo(() => view?.instruments.map((i) => i.id) ?? [], [view]);
  const backfill = useBackfillStatusQuery(instrumentIds);
  const [priceInstrument, setPriceInstrument] = React.useState<Instrument | null>(null);
  const currency = view?.currency ?? "EUR";

  return (
    <>
      <InvestmentsViewGate
        loading={overview.isLoading}
        error={overview.isError || (!overview.isLoading && !view)}
        empty={!!view && !view.hasTransactions}
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
              summary={view.summary}
              breakdown={computeValueBreakdown(view.summary)}
              series={view.series}
              period={period}
              onPeriodChange={setPeriod}
              currency={currency}
            />
            <CostDetailsCard impact={view.costImpact} currency={currency} />
            <PositionsList
              rows={view.summary.rows}
              concentration={computeConcentration(view.summary.rows)}
              currency={currency}
              todayKey={toDateKey(today)}
              backfill={backfill.data ?? []}
              onManualPrice={(row) => setPriceInstrument(view.instrumentsById.get(row.instrument.id) ?? null)}
            />
          </>
        ) : null}
      </InvestmentsViewGate>
      <ManualPriceDialog instrument={priceInstrument} onClose={() => setPriceInstrument(null)} />
    </>
  );
}
