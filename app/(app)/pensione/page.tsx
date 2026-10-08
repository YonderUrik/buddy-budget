"use client";

/** Panoramica di Pensione: valore del fondo con grafico e tre anteprime che portano alle altre schede. */

import { PensionHero, PensionInsights } from "@/components/domain/pension";
import { PensionNoSnapshots } from "@/components/domain/pension";
import { projectPension } from "@/lib/calc/pension";

import { usePensionView } from "@/lib/pension/pension-context";

/** Anni della proiezione mostrata nell'anteprima. */
const OVERVIEW_PROJECTION_YEARS = 25;
const OVERVIEW_BASE_RATE = 0.02;

export default function PensionePage() {
  const view = usePensionView();
  const { performance, last, tfr, scenarios, currency, fund, snapshots } = view;
  if (!fund) return null;
  if (!performance || !last || !tfr) return <PensionNoSnapshots />;
  const pension = scenarios[0];
  const projection = projectPension({
    startValue: last.value,
    quarterlyContribution: view.quarterly,
    years: OVERVIEW_PROJECTION_YEARS,
    rates: { prudent: 0, base: OVERVIEW_BASE_RATE, optimistic: 0.04 },
  }).at(-1)!;
  return (
    <div className="flex flex-col gap-10">
      <PensionHero name={fund.name} performance={performance} snapshots={snapshots} currency={currency} />
      <PensionInsights
        fundAnnualReturn={performance.annualReturn}
        companyTfrRate={tfr.annualRate}
        netRange={{ low: pension.netLow, high: pension.netHigh }}
        projection={{ years: OVERVIEW_PROJECTION_YEARS, base: projection.base }}
        currency={currency}
      />
    </div>
  );
}
