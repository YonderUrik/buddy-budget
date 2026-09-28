"use client";

/**
 * Riepilogo del capitolo investimenti della storia del login: una frase su quanto ha aggiunto il mercato e una barra
 * che si compone pezzo per pezzo per tipo di strumento, con la legenda che compare insieme al suo segmento.
 */

import { motion } from "motion/react";
import type { AllocationSlice } from "./pac-story.utils";
import { STORY_EASE } from "./story-row";

/** Ritardo tra un segmento della barra e il successivo, in secondi. */
const SEGMENT_STAGGER_S = 0.35;

export interface PacStorySummaryProps {
  invested: number;
  value: number;
  allocation: readonly AllocationSlice[];
}

function euro(amount: number): string {
  return `${Math.round(amount).toLocaleString("it-IT")} €`;
}

export function PacStorySummary({ invested, value, allocation }: PacStorySummaryProps) {
  const gain = value - invested;
  const pct = invested > 0 ? (gain / invested) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
      transition={{ duration: 0.5, ease: STORY_EASE }}
      className="flex flex-col gap-3"
    >
      <p className="text-sm leading-snug text-sidebar-foreground/75">
        Su <span className="font-medium text-sidebar-foreground">{euro(invested)}</span> versati il mercato ha{" "}
        {gain < 0 ? "tolto" : "aggiunto"}{" "}
        <span className="font-heading text-base text-sidebar-foreground">
          {gain < 0 ? "−" : "+"}
          {euro(Math.abs(gain))} ({pct.toFixed(1).replace(".", ",")}%)
        </span>
        .
      </p>

      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-sidebar-foreground/10">
        {allocation.map((slice, i) => (
          <motion.span
            key={slice.label}
            initial={{ width: 0 }}
            animate={{ width: `${slice.share * 100}%` }}
            transition={{ delay: 0.3 + i * SEGMENT_STAGGER_S, duration: 0.6, ease: STORY_EASE }}
            className="h-full"
            style={{ backgroundColor: `var(${slice.swatchVar})` }}
          />
        ))}
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-sidebar-foreground/70">
        {allocation.map((slice, i) => (
          <motion.li
            key={slice.label}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 + i * SEGMENT_STAGGER_S, duration: 0.4, ease: STORY_EASE }}
            className="flex items-center gap-1.5"
          >
            <span className="size-2 rounded-full" style={{ backgroundColor: `var(${slice.swatchVar})` }} aria-hidden="true" />
            {slice.label}
            <span className="tabular-nums text-sidebar-foreground">{Math.round(slice.share * 100)}%</span>
          </motion.li>
        ))}
      </ul>
    </motion.div>
  );
}
