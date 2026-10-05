"use client";

/** "Per area": mappa a punti con le aree dove sei investito e, sotto, l'elenco; toccando una riga la mappa la evidenzia. */

import * as React from "react";
import type { CompositionSlice } from "@/lib/calc/investments";
import { AREA_LABELS, type AreaKey } from "@/lib/investments/exposure-keys";
import { AREA_COLOR } from "./exposure-colors";
import { ExposureRows } from "./exposure-rows";
import { WorldDotMap } from "./world-dot-map";

export interface AreaSectionProps {
  slices: CompositionSlice[];
  currency: string;
  insight: string | null;
}

export function AreaSection({ slices, currency, insight }: AreaSectionProps) {
  const [active, setActive] = React.useState<AreaKey | null>(null);
  const shares = React.useMemo(() => Object.fromEntries(slices.map((s) => [s.key, s.share])) as Partial<Record<AreaKey, number>>, [slices]);
  return (
    <section className="flex flex-col gap-3" aria-label="Per area">
      <div>
        <h3 className="text-sm font-medium text-foreground">Per area</h3>
        {insight ? <p className="text-sm text-muted-foreground">{insight}</p> : null}
      </div>
      <WorldDotMap shares={shares} active={active} className="w-full" />
      <ExposureRows
        label="Aree geografiche"
        slices={slices}
        currency={currency}
        labelFor={(key) => AREA_LABELS[key as AreaKey] ?? key}
        colorFor={(key) => AREA_COLOR[key as AreaKey] ?? "var(--swatch-slate)"}
        activeKey={active}
        onActiveChange={(key) => setActive(key as AreaKey | null)}
      />
    </section>
  );
}
