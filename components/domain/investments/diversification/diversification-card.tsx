"use client";

/**
 * Card "Diversificazione": ripartizione per area geografica e per settore guardando dentro ETF e fondi, quanta parte
 * è classificata, da dove vengono i dati di ogni posizione e la correzione manuale.
 */

import * as React from "react";
import type { ExposureRow, InvestmentsAnalysis } from "@/lib/investments/analysis-view";
import { areaInsight, sectorInsight } from "@/lib/investments/exposure";
import { AREA_LABELS, SECTOR_LABELS, type AreaKey, type SectorKey } from "@/lib/investments/exposure-keys";
import { PortfolioComposition } from "../portfolio-composition";
import { BreakdownDialog } from "./breakdown-dialog";
import { AREA_COLOR, SECTOR_COLOR } from "./exposure-colors";
import { ExposureSourcesList } from "./exposure-sources-list";

/** Sotto questa copertura si invita a correggere le posizioni senza dati. */
const LOW_COVERAGE = 0.9;

export interface DiversificationCardProps {
  analysis: Pick<InvestmentsAnalysis, "sectors" | "areas" | "exposureRows">;
  currency: string;
}

function coverageText(areas: number, sectors: number): string | null {
  const worst = Math.min(areas, sectors);
  if (worst >= LOW_COVERAGE) return null;
  return `Il ${Math.round((1 - worst) * 100)}% del valore non è classificato: puoi correggerlo a mano qui sotto.`;
}

export function DiversificationCard({ analysis, currency }: DiversificationCardProps) {
  const [editing, setEditing] = React.useState<ExposureRow | null>(null);
  const coverage = coverageText(analysis.areas.classifiedShare, analysis.sectors.classifiedShare);
  return (
    <>
      <PortfolioComposition
        title="Diversificazione"
        subtitle="Dove investi davvero, guardando dentro ETF e fondi"
        currency={currency}
        groups={[
          {
            title: "Per area",
            slices: analysis.areas.slices,
            labelFor: (key) => AREA_LABELS[key as AreaKey] ?? key,
            colorFor: (key) => AREA_COLOR[key as AreaKey] ?? "var(--swatch-slate)",
            insight: areaInsight(analysis.areas),
          },
          {
            title: "Per settore",
            slices: analysis.sectors.slices,
            labelFor: (key) => SECTOR_LABELS[key as SectorKey] ?? key,
            colorFor: (key) => SECTOR_COLOR[key as SectorKey] ?? "var(--swatch-slate)",
            insight: sectorInsight(analysis.sectors),
          },
        ]}
      >
        {coverage ? <p className="text-sm text-muted-foreground">{coverage}</p> : null}
        <ExposureSourcesList rows={analysis.exposureRows} onEdit={setEditing} />
        <p className="text-xs text-muted-foreground">
          Per gli ETF Yahoo dà solo i settori: le aree degli indici più diffusi sono una stima indicativa, le altre puoi inserirle tu.
        </p>
      </PortfolioComposition>
      <BreakdownDialog row={editing} onClose={() => setEditing(null)} />
    </>
  );
}
