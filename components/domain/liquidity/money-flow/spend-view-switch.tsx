"use client";

/** Switch of «Dove vanno i soldi» between the groups view (ring and list) and the money-flow view; remembered per device. */

import * as React from "react";
import { cn } from "@/lib/utils";

export type SpendView = "gruppi" | "flusso";

const STORAGE_KEY = "bb.liquidity.spend-view";
const OPTIONS: readonly { value: SpendView; label: string }[] = [
  { value: "gruppi", label: "Per gruppi" },
  { value: "flusso", label: "Percorso" },
];

/** Chosen view, read once from localStorage (falls back to the groups view when storage is unavailable). */
export function useSpendView(initial?: SpendView): [SpendView, (view: SpendView) => void] {
  const [view, setView] = React.useState<SpendView>(initial ?? "gruppi");
  React.useEffect(() => {
    if (initial) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "gruppi" || saved === "flusso") setView(saved);
    } catch {}
  }, [initial]);
  const choose = React.useCallback((next: SpendView) => {
    setView(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }, []);
  return [view, choose];
}

export interface SpendViewSwitchProps {
  value: SpendView;
  onChange: (view: SpendView) => void;
}

export function SpendViewSwitch({ value, onChange }: SpendViewSwitchProps) {
  return (
    <div role="radiogroup" aria-label="Vista delle spese" className="inline-flex w-fit rounded-full bg-muted p-1">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex min-h-10 items-center rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-ring",
            value === o.value ? "bg-card text-foreground" : "text-text-2 hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
