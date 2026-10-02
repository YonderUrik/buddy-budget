"use client";

/** Andamento del fondo: grafico di contributi e controvalore, poi la ripartizione anno per anno. */

import { PensionChartCard, PensionNoSnapshots, PensionYearlyCard } from "@/components/domain/pension";

import { yearlyBreakdown } from "@/lib/calc/pension";
import { usePensionView } from "@/lib/pension/pension-context";

export default function PensioneAndamentoPage() {
  const { snapshots, currency } = usePensionView();
  if (snapshots.length === 0) return <PensionNoSnapshots />;
  return (
    <>
      <PensionChartCard snapshots={snapshots} currency={currency} />
      <PensionYearlyCard years={yearlyBreakdown(snapshots)} currency={currency} />
    </>
  );
}
