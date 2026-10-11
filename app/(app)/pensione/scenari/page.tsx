"use client";

/** Scenari: se prelevassi oggi, fondo contro TFR in azienda e quando scende l'aliquota. */

import { PensionNoSnapshots, PensionTaxCard, PensionTfrCompareCard, PensionWithdrawalCard } from "@/components/domain/pension";

import { ASSUMED_INFLATION, usePensionView } from "@/lib/pension/pension-context";
import { useRateSimulation } from "@/lib/pension/use-rate-simulation";

export default function PensioneScenariPage() {
  const { last, performance, tfr, fund, today, currency } = usePensionView();
  const adhesion = fund?.adhesionDate ?? null;
  const simulation = useRateSimulation({ adhesionDate: adhesion, today, last });
  if (!last || !performance || !tfr) return <PensionNoSnapshots />;
  return (
    <div className="flex flex-col gap-10">
      <PensionWithdrawalCard scenarios={simulation.scenarios} baseline={simulation.baseline} isSimulated={simulation.isSimulated} value={last.value} currency={currency} />
      <PensionTfrCompareCard fundValue={last.value} fundAnnualReturn={performance.annualReturn} comparison={tfr} inflationRate={ASSUMED_INFLATION} currency={currency} />
      {adhesion ? (
        <PensionTaxCard
          adhesionDate={adhesion}
          years={simulation.years}
          realYears={simulation.realYears}
          isSimulated={simulation.isSimulated}
          scenario={simulation.scenarios[0]}
          baseline={simulation.baseline[0]}
          currency={currency}
          onYearsChange={simulation.setYears}
          onCommit={simulation.commit}
          onReset={simulation.reset}
        />
      ) : null}
    </div>
  );
}
