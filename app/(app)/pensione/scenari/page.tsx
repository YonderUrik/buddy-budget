"use client";

/** Scenari: se prelevassi oggi, fondo contro TFR in azienda e quando scende l'aliquota. */

import { PensionNoSnapshots, PensionTaxCard, PensionTfrCompareCard, PensionWithdrawalCard } from "@/components/domain/pension";

import { ASSUMED_INFLATION, usePensionView } from "@/lib/pension/pension-context";

export default function PensioneScenariPage() {
  const { last, performance, tfr, scenarios, fund, today, currency } = usePensionView();
  const adhesion = fund?.adhesionDate ?? null;
  if (!last || !performance || !tfr) return <PensionNoSnapshots />;
  return (
    <>
      <PensionWithdrawalCard scenarios={scenarios} value={last.value} currency={currency} />
      <PensionTfrCompareCard fundValue={last.value} fundAnnualReturn={performance.annualReturn} comparison={tfr} inflationRate={ASSUMED_INFLATION} currency={currency} />
      {adhesion ? <PensionTaxCard adhesionDate={adhesion} today={today} /> : null}
    </>
  );
}
