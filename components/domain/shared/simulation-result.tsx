/**
 * The answer of a simulator: a short label, the result as a big figure (the Panoramica number style) and one line of
 * context. Used wherever a "what if" control returns a single answer, so every simulator reads the same way.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Colour of the figure: neutral, a gain (`pos`) or a cost (`neg`). */
export type SimulationResultTone = "neutral" | "pos" | "neg";

export interface SimulationResultProps {
  /** Already translated label above the figure (e.g. «Finisci prima di»). */
  label: ReactNode;
  /** The figure itself, already formatted. */
  value: ReactNode;
  tone?: SimulationResultTone;
  /** One line under the figure with what it means. */
  caption?: ReactNode;
  className?: string;
}

const TONE_CLASS: Record<SimulationResultTone, string> = {
  neutral: "text-foreground",
  pos: "text-pos",
  neg: "text-neg",
};

export function SimulationResult({ label, value, tone = "neutral", caption, className }: SimulationResultProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)} aria-live="polite">
      <p className="text-sm text-text-2">{label}</p>
      <p className={cn("font-heading text-4xl font-medium leading-none tracking-tight tabular-nums sm:text-5xl", TONE_CLASS[tone])}>{value}</p>
      {caption ? <p className="pt-1 text-sm text-text-2">{caption}</p> : null}
    </div>
  );
}
