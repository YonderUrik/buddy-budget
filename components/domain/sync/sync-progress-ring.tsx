"use client";

/** Anello di avanzamento dell'isola dei sync: si riempie con una molla se il totale è noto, altrimenti gira. */

import { motion } from "motion/react";
import { SPRING_SOFT } from "@/lib/motion/springs";
import type { OverallProgress } from "@/lib/sync-jobs/view";

export interface SyncProgressRingProps {
  progress: OverallProgress;
  /** Etichetta accessibile (il titolo del job). */
  label: string;
}

const RADIUS = 9;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Porzione di anello mostrata quando l'avanzamento non è noto. */
const INDETERMINATE_ARC = 0.28;

export function SyncProgressRing({ progress, label }: SyncProgressRingProps) {
  const determinate = progress.kind === "determinate";
  const fraction = determinate ? progress.processed / Math.max(progress.total, 1) : INDETERMINATE_ARC;
  return (
    <svg
      viewBox="0 0 24 24"
      className={determinate ? "size-5 -rotate-90" : "size-5 -rotate-90 motion-safe:animate-spin"}
      role="progressbar"
      aria-label={label}
      aria-valuemin={determinate ? 0 : undefined}
      aria-valuemax={determinate ? progress.total : undefined}
      aria-valuenow={determinate ? progress.processed : undefined}
      aria-busy={determinate ? undefined : true}
    >
      <circle cx="12" cy="12" r={RADIUS} fill="none" strokeWidth="3" className="stroke-muted-foreground/30" />
      <motion.circle
        cx="12"
        cy="12"
        r={RADIUS}
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        initial={false}
        animate={{ strokeDashoffset: CIRCUMFERENCE * (1 - fraction) }}
        transition={SPRING_SOFT}
        className="stroke-foreground"
      />
    </svg>
  );
}
