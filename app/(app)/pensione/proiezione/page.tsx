"use client";

/** Proiezione a pensione con scenari e slider. */

import { PensionNoSnapshots, PensionProjectionCard } from "@/components/domain/pension";

import { usePensionView } from "@/lib/pension/pension-context";

export default function PensioneProiezionePage() {
  const { last, quarterly, currency } = usePensionView();
  if (!last) return <PensionNoSnapshots />;
  return <PensionProjectionCard startValue={last.value} defaultQuarterlyContribution={quarterly} currency={currency} />;
}
