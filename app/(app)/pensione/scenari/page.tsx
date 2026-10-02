"use client";

/** Scenari: se prelevassi oggi, fondo contro TFR in azienda e quando scende l'aliquota. */

import { PensionEmptyState, PensionTaxCard, PensionTfrCompareCard, PensionWithdrawalCard } from "@/components/domain/pension";

import { ASSUMED_INFLATION, usePensionView } from "@/lib/pension/use-pension-view";

export default function PensioneScenariPage() {
  const { last, performance, tfr, scenarios, adhesion, today, currency } = usePensionView();
  if (!last || !performance || !tfr) return <PensionEmptyState />;
  return (
    <>
      <PensionWithdrawalCard scenarios={scenarios} value={last.value} currency={currency} />
      <PensionTfrCompareCard fundValue={last.value} fundAnnualReturn={performance.annualReturn} comparison={tfr} inflationRate={ASSUMED_INFLATION} currency={currency} />
      {adhesion ? <PensionTaxCard adhesionDate={adhesion} today={today} /> : null}
    </>
  );
}
