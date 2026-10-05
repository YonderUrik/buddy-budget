/** "Per settore": elenco ordinato con un'icona per ogni settore. */

import type { CompositionSlice } from "@/lib/calc/investments";
import { SECTOR_LABELS, type SectorKey } from "@/lib/investments/exposure-keys";
import { SECTOR_COLOR } from "./exposure-colors";
import { ExposureRows } from "./exposure-rows";
import { SECTOR_ICON } from "./sector-icons";

export interface SectorSectionProps {
  slices: CompositionSlice[];
  currency: string;
  insight: string | null;
}

export function SectorSection({ slices, currency, insight }: SectorSectionProps) {
  return (
    <section className="flex flex-col gap-3" aria-label="Per settore">
      <div>
        <h3 className="text-sm font-medium text-foreground">Per settore</h3>
        {insight ? <p className="text-sm text-muted-foreground">{insight}</p> : null}
      </div>
      <ExposureRows
        label="Settori"
        slices={slices}
        currency={currency}
        labelFor={(key) => SECTOR_LABELS[key as SectorKey] ?? key}
        colorFor={(key) => SECTOR_COLOR[key as SectorKey] ?? "var(--swatch-slate)"}
        iconFor={(key) => SECTOR_ICON[key as SectorKey] ?? SECTOR_ICON.altro}
      />
    </section>
  );
}
