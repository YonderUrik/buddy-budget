"use client";

/** Tessera "Investimenti": valore del portafoglio con una linea che segue il mercato e il guadagno sul versato. */

import { cn } from "@/lib/utils";
import { MosaicLineChart } from "./mosaic-line-chart";
import { MosaicTile } from "./mosaic-tile";
import { StoryCountUp } from "./story-count-up";
import type { MosaicLive } from "./login-mosaic.model";

export interface MosaicInvestmentsTileProps {
  live: MosaicLive;
  className?: string;
}

export function MosaicInvestmentsTile({ live, className }: MosaicInvestmentsTileProps) {
  const { investments, invested } = live.state;
  const gain = investments - invested;
  const positive = gain >= 0;

  return (
    <MosaicTile
      title="Investimenti"
      index={2}
      pulse={live.step}
      className={className}
      aside={
        <span className={cn("font-medium", positive ? "text-pos" : "text-neg")}>
          {positive ? "▲ +" : "▼ −"}
          <StoryCountUp value={Math.abs(gain)} duration={0.8} />
        </span>
      }
    >
      <div className="mt-1 font-heading text-xl font-semibold tracking-tight">
        <StoryCountUp value={investments} duration={1.4} />
      </div>
      <MosaicLineChart values={live.investHistory} height={36} tone={positive ? "pos" : "neg"} className="-mx-1" />
      <div className="mt-1 text-[11px] text-sidebar-foreground/60">PAC 150 € al mese · ETF, azioni, BTP</div>
    </MosaicTile>
  );
}
