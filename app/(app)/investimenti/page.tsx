"use client";

/**
 * Scheda Portafoglio di Investimenti, la più essenziale: quanto vale e quanto ha guadagnato, e le posizioni.
 * Performance, diversificazione, proventi, tasse e operazioni hanno le loro schede; titolo, schede e dialog
 * "Registra"/"Importa" sono nel layout.
 */

import * as React from "react";
import {
  BrokerStatements,
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
  const [includeCash, setIncludeCash] = React.useState(true);
  const [period, setPeriod] = React.useState<NetWorthPeriod>(INVESTMENTS_DEFAULT_PERIOD);
  const { overview, view, today } = useInvestmentsView(period);
  const instrumentIds = React.useMemo(() => view?.instruments.map((i) => i.id) ?? [], [view]);
  const backfill = useBackfillStatusQuery(instrumentIds);
  const [priceInstrument, setPriceInstrument] = React.useState<Instrument | null>(null);
  const cash = overview.data?.brokerCash ?? [];
  const currency = view?.currency ?? "EUR";

  return (
    <>
      <BrokerStatements compact />
      <InvestmentsViewGate
        loading={overview.isLoading}
        error={overview.isError || (!overview.isLoading && !view)}
        empty={!!view && !view.hasTransactions && !cash.length}
        onRetry={() => overview.refetch()}
      >
        {view ? (
          <>
            <PortfolioHeroCard
              cash={cash}
              includeCash={includeCash}
              onIncludeCashChange={setIncludeCash}
              summary={view.summary}
              breakdown={computeValueBreakdown(view.summary)}
              series={view.series}
              period={period}
              onPeriodChange={setPeriod}
              currency={currency}
            />
            {view.hasTransactions ? (
              <PositionsList
                rows={view.summary.rows}
                concentration={computeConcentration(view.summary.rows)}
                currency={currency}
                todayKey={toDateKey(today)}
                backfill={backfill.data ?? []}
                onManualPrice={(row) => setPriceInstrument(view.instrumentsById.get(row.instrument.id) ?? null)}
              />
            ) : null}
          </>
        ) : null}
      </InvestmentsViewGate>
      <ManualPriceDialog instrument={priceInstrument} onClose={() => setPriceInstrument(null)} />
    </>
  );
}
