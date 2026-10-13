"use client";

/** Andamento del fondo: grafico di contributi e controvalore, poi la ripartizione anno per anno. */

import { ChartLineIcon } from "lucide-react";
import { PensionNoSnapshots, PensionSection, PensionTrendChart, PensionYearlyCard } from "@/components/domain/pension";

import { yearlyBreakdown } from "@/lib/calc/pension";
import { usePensionView } from "@/lib/pension/pension-context";

export default function PensioneAndamentoPage() {
  const { snapshots, currency } = usePensionView();
  if (snapshots.length === 0) return <PensionNoSnapshots />;
  return (
    <div className="flex flex-col gap-10">
      <PensionSection icon={ChartLineIcon} title="Andamento del fondo" color="var(--primary)" description="I contributi versati e il controvalore del fondo, fotografia dopo fotografia.">
        <div className="-mx-4 sm:-mx-6">
          <PensionTrendChart snapshots={snapshots} currency={currency} />
        </div>
      </PensionSection>
      <PensionYearlyCard years={yearlyBreakdown(snapshots)} currency={currency} />
    </div>
  );
}
