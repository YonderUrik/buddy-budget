"use client";

/**
 * Line over a history chart while imported data is on its way in: during a file import or bank sync it says the
 * chart will follow by itself, then that it is reloading. Floats over the chart, so it never pushes the layout.
 */

import { TextShimmer } from "@/components/motion";
import type { ChartRefreshState } from "@/lib/net-worth/refresh-status";
import { useLocalization } from "@/lib/localization/provider";
import { cn } from "@/lib/utils";

export const CHART_REFRESH_MESSAGES: Record<Exclude<ChartRefreshState, null>, string> = {
  importing: "Sto aggiungendo i nuovi movimenti: il grafico si aggiorna da solo appena finisco.",
  updating: "Aggiorno il grafico con i nuovi movimenti…",
};

export interface ChartRefreshNoteProps {
  state: ChartRefreshState;
  className?: string;
}

export function ChartRefreshNote({ state, className }: ChartRefreshNoteProps) {
  const { t: tr } = useLocalization();
  return (
    <p role="status" aria-live="polite" className={cn("pointer-events-none absolute inset-x-4 top-2 z-10 flex justify-center sm:inset-x-6", className)}>
      {state ? (
        <span className="max-w-full rounded-full bg-background/90 px-3 py-1.5 text-center text-sm text-text-2 ring-1 ring-border">
          <TextShimmer>{tr(CHART_REFRESH_MESSAGES[state])}</TextShimmer>
        </span>
      ) : null}
    </p>
  );
}
