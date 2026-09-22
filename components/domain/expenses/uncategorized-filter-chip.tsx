"use client";

/** Chip "Da categorizzare (n)": attiva/disattiva il filtro sulle sole transazioni in categoria fallback. */

import { cn } from "@/lib/utils";

export interface UncategorizedFilterChipProps {
  count: number;
  active: boolean;
  onToggle: () => void;
}

export function UncategorizedFilterChip({ count, active, onToggle }: UncategorizedFilterChipProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={cn(
        "flex min-h-9 items-center gap-1.5 rounded-full border border-neg/40 px-3 text-sm font-medium text-neg sm:min-h-8",
        active ? "bg-neg-soft" : "hover:bg-neg-soft/50"
      )}
    >
      <span className="relative flex size-1.5" aria-hidden="true">
        <span className="absolute inline-flex size-full rounded-full bg-neg opacity-75 motion-safe:animate-ping" />
        <span className="relative inline-flex size-1.5 rounded-full bg-neg" />
      </span>
      Da categorizzare ({count})
    </button>
  );
}
