"use client";

/** Tessera "Patrimonio netto": il numero scorre a ogni movimento, la variazione sale e svanisce, il grafico si trasforma. */

import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { MosaicLineChart } from "./mosaic-line-chart";
import { LandmarkIcon } from "lucide-react";
import { MosaicTile } from "./mosaic-tile";
import { StoryCountUp } from "./story-count-up";
import { liquidity, netWorth, type MosaicLive } from "./login-mosaic.model";

export interface MosaicNetWorthTileProps {
  live: MosaicLive;
  className?: string;
}

/** Riga della legenda di composizione: pallino, etichetta e valore che scorre. */
function CompositionLegend({
  label,
  value,
  colorClass,
  negative = false,
}: {
  label: string;
  value: number;
  colorClass: string;
  negative?: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <span className={cn("size-2 rounded-full", colorClass)} />
      <span className="text-text-3">{label}</span>
      <span className={cn("ml-auto font-medium", negative ? "text-neg" : "text-foreground")}>
        {negative ? "− " : ""}
        <StoryCountUp value={value} duration={0.9} />
      </span>
    </span>
  );
}

export function MosaicNetWorthTile({ live, className }: MosaicNetWorthTileProps) {
  const { state, netDelta, step } = live;
  const net = netWorth(state);
  const cash = Math.max(0, liquidity(state));
  const invested = state.investments;
  const deltaIsPositive = netDelta >= 0;

  return (
    <MosaicTile
      title="Patrimonio netto"
      icon={LandmarkIcon}
      color="var(--primary)"
      index={0}
      pulse={step}
      className={className}
      aside={
        <span className="flex items-center gap-1.5">
          <span className="flex items-center gap-1.5 text-pos">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-pos opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex size-1.5 rounded-full bg-pos" />
            </span>
            in diretta
          </span>
          <span aria-hidden="true">·</span>
          dati di esempio
        </span>
      }
    >
      <div className="mt-3 grid flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] items-center gap-4">
        <div className="flex flex-col">
          <div className="flex items-baseline gap-2">
            <span className="font-heading text-4xl font-medium tracking-tight">
              <StoryCountUp value={net} duration={1.6} />
            </span>
          </div>
          <div className="relative h-5">
            <AnimatePresence>
              {netDelta !== 0 ? (
                <motion.span
                  key={step}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
                  transition={{ duration: 0.45 }}
                  className={cn("absolute left-0 top-0.5 text-sm font-medium tabular-nums", deltaIsPositive ? "text-pos" : "text-neg")}
                >
                  {deltaIsPositive ? "▲ +" : "▼ −"}
                  {formatCurrency(Math.abs(netDelta), "EUR", { maximumFractionDigits: 0 })}
                </motion.span>
              ) : null}
            </AnimatePresence>
          </div>

          <div className="mt-1.5 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
            <motion.i
              className="block h-full rounded-full bg-primary"
              initial={{ flexGrow: 0 }}
              animate={{ flexGrow: cash }}
              transition={{ duration: 1.2, delay: 0.4, ease: "easeOut" }}
            />
            <motion.i
              className="block h-full rounded-full bg-[var(--swatch-blue)]"
              initial={{ flexGrow: 0 }}
              animate={{ flexGrow: invested }}
              transition={{ duration: 1.2, delay: 0.55, ease: "easeOut" }}
            />
          </div>
          <div className="mt-2 flex flex-col gap-0.5">
            <CompositionLegend label="Liquidità" value={cash} colorClass="bg-primary" />
            <CompositionLegend label="Investimenti" value={invested} colorClass="bg-[var(--swatch-blue)]" />
            <CompositionLegend label="Debiti" value={state.debt} colorClass="bg-neg" negative />
          </div>
        </div>

        <MosaicLineChart values={live.netHistory} height={104} area />
      </div>
    </MosaicTile>
  );
}
