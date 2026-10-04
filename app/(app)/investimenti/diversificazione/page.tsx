"use client";

/**
 * Scheda Diversificazione di Investimenti: composizione per tipo e valuta, settori e aree guardando dentro gli ETF,
 * sovrapposizioni e correlazioni, allocazione obiettivo con il suggerimento del prossimo versamento.
 */

import * as React from "react";
import {
  AllocationCard,
  CURRENCY_COLORS,
  DiversificationCard,
  INSTRUMENT_TYPE_COLOR,
  InvestmentsViewGate,
  OverlapCard,
  PortfolioComposition,
  useRegisterPurchase,
} from "@/components/domain/investments";
import type { InstrumentType } from "@/lib/db/schema/investments";
import { CURRENCY_EXPOSURE_THRESHOLD, computeCurrencyExposure } from "@/lib/investments/insights";
import { INSTRUMENT_TYPE_LABELS, INVESTMENTS_DEFAULT_PERIOD } from "@/lib/investments/labels";
import { useInvestmentsView } from "@/lib/queries/investments-view";

function typeLabel(key: string): string {
  return INSTRUMENT_TYPE_LABELS[key as InstrumentType] ?? key;
}

/** Frase sull'esposizione valutaria: sotto soglia non c'è rischio di cambio da segnalare. */
function currencyInsight(exposure: number, currency: string): string {
  if (exposure < CURRENCY_EXPOSURE_THRESHOLD) return `Quasi tutto in ${currency}: il cambio non sposta il valore.`;
  return `Il ${Math.round(exposure * 100)}% è in altre valute: il cambio muove il valore anche a mercati fermi.`;
}

export default function DiversificazionePage() {
  const { overview, view, today } = useInvestmentsView(INVESTMENTS_DEFAULT_PERIOD);
  const registerPurchase = useRegisterPurchase(view, today);
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
          <PortfolioComposition
            currency={currency}
            groups={[
              {
                title: "Per tipo",
                slices: view.byType,
                labelFor: typeLabel,
                colorFor: (key) => INSTRUMENT_TYPE_COLOR[key as InstrumentType] ?? "var(--swatch-slate)",
                insight: view.byType[0] ? `Soprattutto ${typeLabel(view.byType[0].key)} (${Math.round(view.byType[0].share * 100)}%).` : null,
              },
              {
                title: "Per valuta",
                slices: view.byCurrency,
                colorFor: (_key, index) => CURRENCY_COLORS[index % CURRENCY_COLORS.length],
                insight: currencyInsight(computeCurrencyExposure(view.byCurrency, currency), currency),
              },
            ]}
          />
          {view.analysis.exposureRows.length > 0 ? <DiversificationCard analysis={view.analysis} currency={currency} /> : null}
          {view.analysis.exposureRows.length > 1 ? (
            <OverlapCard analysis={view.analysis} instrumentsById={view.instrumentsById} currency={currency} />
          ) : null}
          <AllocationCard
            allocation={view.analysis.allocation}
            targets={view.analysis.targets}
            positions={view.summary.rows.map((r) => ({ instrumentId: r.instrument.id, value: r.value }))}
            instrumentsById={view.instrumentsById}
            suggestions={view.usedInstruments}
            currency={currency}
            onRegister={(instrumentId, amount) => registerPurchase({ instrumentId, amount: String(amount) })}
          />
        </>
      ) : null}
    </InvestmentsViewGate>
  );
}
