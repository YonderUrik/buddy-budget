"use client";

/** Panoramica di Pensione: di cosa è fatto il fondo e tre anteprime che portano alle altre schede. */

import { PensionEmptyState, PensionInsightCards, PensionSummaryCard } from "@/components/domain/pension";
import { projectPension } from "@/lib/calc/pension";

import { usePensionView } from "@/lib/pension/use-pension-view";

/** Anni della proiezione mostrata nell'anteprima. */
const OVERVIEW_PROJECTION_YEARS = 25;
const OVERVIEW_BASE_RATE = 0.02;

export default function PensionePage() {
  const view = usePensionView();
  const { performance, last, tfr, scenarios, currency } = view;
  if (!performance || !last || !tfr) return <PensionEmptyState />;
  const pension = scenarios[0];
  const projection = projectPension({
    startValue: last.value,
    quarterlyContribution: view.quarterly,
    years: OVERVIEW_PROJECTION_YEARS,
    rates: { prudent: 0, base: OVERVIEW_BASE_RATE, optimistic: 0.04 },
  }).at(-1)!;
  return (
    <>
      <PensionSummaryCard name={view.store.profile.name} performance={performance} currency={currency} />
      <PensionInsightCards
        fundAnnualReturn={performance.annualReturn}
        companyTfrRate={tfr.annualRate}
        netRange={{ low: pension.netLow, high: pension.netHigh }}
        projection={{ years: OVERVIEW_PROJECTION_YEARS, base: projection.base }}
        currency={currency}
      />
    </>
  );
}
