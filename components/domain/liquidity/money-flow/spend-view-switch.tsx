"use client";

/**
 * Switch of «Dove vanno i soldi» between «Per gruppi» (ring and list, the default) and «Percorso» (the money-flow
 * picture). The choice is remembered on the device (`usePersistedFlag`).
 */

import * as React from "react";
import { track } from "@/lib/analytics";
import { usePersistedFlag } from "@/lib/hooks/use-persisted-flag";
import { useLocalization } from "@/lib/localization/provider";
import { cn } from "@/lib/utils";

export type SpendView = "gruppi" | "percorso";

const STORAGE_KEY = "bb.liquidity.spend-view.percorso";
const OPTIONS: readonly SpendView[] = ["gruppi", "percorso"];

/** The chosen view (groups until the user picks the flow) and its setter, which saves it and counts it in Umami. */
export function useSpendView(): [SpendView, (view: SpendView) => void] {
  const [flow, setFlow] = usePersistedFlag(STORAGE_KEY, false);
  const choose = React.useCallback(
    (next: SpendView) => {
      setFlow(next === "percorso");
      track("liquidity_spend_view_changed", { view: next });
    },
    [setFlow]
  );
  return [flow ? "percorso" : "gruppi", choose];
}

export interface SpendViewSwitchProps {
  value: SpendView;
  onChange: (view: SpendView) => void;
}

/** Two-option segmented control, same look as the other pill switches of Liquidità. */
export function SpendViewSwitch({ value, onChange }: SpendViewSwitchProps) {
  const { t: tr } = useLocalization();
  return (
    <div role="radiogroup" aria-label={tr("Vista delle spese")} className="inline-flex w-fit rounded-full bg-muted p-1">
      {OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          onClick={() => value !== option && onChange(option)}
          className={cn(
            "flex min-h-11 items-center rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-ring",
            value === option ? "bg-card text-foreground" : "text-text-2 hover:text-foreground"
          )}
        >
          {option === "gruppi" ? tr("Per gruppi") : tr("Percorso")}
        </button>
      ))}
    </div>
  );
}
