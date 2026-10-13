/** Riga «Ce l'hai già dentro»: i fondi posseduti che contengono quest'azione tra i primi titoli, con il peso. */

import { LayersIcon } from "lucide-react";
import type { HoldingElsewhere } from "@/lib/investments/overlap";
import { PanelSection } from "../panel-section";
import { formatPct } from "../percent";

export interface TitleInsideFundsProps {
  funds: HoldingElsewhere[];
}

export function TitleInsideFunds({ funds }: TitleInsideFundsProps) {
  if (funds.length === 0) return null;
  return (
    <PanelSection icon={LayersIcon} title="Ce l'hai già dentro" color="var(--swatch-emerald)">
      <ul className="flex flex-col gap-1.5 text-sm">
        {funds.map((fund) => (
          <li key={fund.id} className="flex justify-between gap-3">
            <span className="truncate text-foreground">{fund.name}</span>
            <span className="tabular-nums text-muted-foreground">{fund.weight !== null ? `${formatPct(fund.weight)} del fondo` : "diretta"}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">Dai primi titoli dei fondi che possiedi (fonte Yahoo Finance).</p>
    </PanelSection>
  );
}
