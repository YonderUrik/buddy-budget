"use client";

/**
 * Card "Diversificazione": ripartizione per area (mappa) e per settore (icone) guardando dentro ETF e fondi, quanta
 * parte è classificata; da dove vengono i dati di ogni posizione e la correzione manuale si aprono su richiesta.
 */

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ExposureRow, InvestmentsAnalysis } from "@/lib/investments/analysis-view";
import { areaInsight, sectorInsight } from "@/lib/investments/exposure";
import { Disclosure } from "../disclosure";
import { AreaSection } from "./area-section";
import { BreakdownDialog } from "./breakdown-dialog";
import { ExposureSourcesList } from "./exposure-sources-list";
import { SectorSection } from "./sector-section";

/** Sotto questa copertura si invita a correggere le posizioni senza dati. */
const LOW_COVERAGE = 0.9;

export interface DiversificationCardProps {
  analysis: Pick<InvestmentsAnalysis, "sectors" | "areas" | "exposureRows">;
  currency: string;
}

function coverageText(areas: number, sectors: number): string | null {
  const worst = Math.min(areas, sectors);
  if (worst >= LOW_COVERAGE) return null;
  return `Il ${Math.round((1 - worst) * 100)}% del valore non è classificato: puoi correggerlo da "Da dove vengono i dati".`;
}

export function DiversificationCard({ analysis, currency }: DiversificationCardProps) {
  const [editing, setEditing] = React.useState<ExposureRow | null>(null);
  const coverage = coverageText(analysis.areas.classifiedShare, analysis.sectors.classifiedShare);
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Diversificazione</CardTitle>
          <p className="text-sm text-muted-foreground">Dove investi davvero, guardando dentro ETF e fondi</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <AreaSection slices={analysis.areas.slices} currency={currency} insight={areaInsight(analysis.areas)} />
            <SectorSection slices={analysis.sectors.slices} currency={currency} insight={sectorInsight(analysis.sectors)} />
          </div>
          {coverage ? <p className="text-sm text-muted-foreground">{coverage}</p> : null}
          <Disclosure title="Da dove vengono i dati" summary="Fonte di area e settore di ogni posizione, con la possibilità di correggerla">
            <ExposureSourcesList rows={analysis.exposureRows} onEdit={setEditing} />
            <p className="text-xs text-muted-foreground">
              Per gli ETF Yahoo dà solo i settori: le aree degli indici più diffusi sono una stima indicativa, le altre puoi inserirle tu.
            </p>
          </Disclosure>
        </CardContent>
      </Card>
      <BreakdownDialog row={editing} onClose={() => setEditing(null)} />
    </>
  );
}
