"use client";

/** Proiezione a pensione con scenari e slider. */

import { PensionEmptyState, PensionProjectionCard } from "@/components/domain/pension";

import { usePensionView } from "@/lib/pension/use-pension-view";

export default function PensioneProiezionePage() {
  const { last, quarterly, currency } = usePensionView();
  if (!last) return <PensionEmptyState />;
  return <PensionProjectionCard startValue={last.value} defaultQuarterlyContribution={quarterly} currency={currency} />;
}
