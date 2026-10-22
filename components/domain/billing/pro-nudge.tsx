"use client";

import * as React from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { PRO_TRIAL_DAYS } from "@/lib/billing";
import { useLocalization } from "@/lib/localization/provider";
import { cn } from "@/lib/utils";
import type { ProNudgePlace } from "./pro-nudge-places";
import { useProUpsell } from "./use-pro-upsell";

/** How long a dismissed invitation stays hidden in this browser. */
const DISMISS_DAYS = 30;
const DAY_MS = 86_400_000;
const storageKey = (place: ProNudgePlace) => `bb-pro-nudge-${place}`;

function dismissedRecently(place: ProNudgePlace): boolean {
  try {
    const at = Number(window.localStorage.getItem(storageKey(place)));
    return Number.isFinite(at) && at > 0 && Date.now() - at < DISMISS_DAYS * DAY_MS;
  } catch {
    return false;
  }
}

export interface ProNudgeProps {
  /** Where the invitation sits (counted in the events, carried to the plans page). */
  place: ProNudgePlace;
  /** One short line on what Pro adds here. */
  title: string;
  /** The sentence under it. */
  text: string;
  className?: string;
}

/**
 * An invitation to Pro inside a Free screen: a filled block with one sentence and the yellow button, closable for
 * {@link DISMISS_DAYS} days. Renders nothing where there is nothing to buy (Pro, self-hosted, demo, native app).
 */
export function ProNudge({ place, title, text, className }: ProNudgeProps) {
  const { t: tr } = useLocalization();
  const upsell = useProUpsell(place);
  // Read after mount: the server cannot know, and a closed block must not flash.
  const [hidden, setHidden] = React.useState(true);
  React.useEffect(() => {
    const timer = window.setTimeout(() => setHidden(dismissedRecently(place)), 0);
    return () => window.clearTimeout(timer);
  }, [place]);
  if (!upsell || hidden) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(storageKey(place), String(Date.now()));
    } catch {
      // Storage off: the block just closes for this visit.
    }
    track("pro_nudge_dismissed", { place });
    setHidden(true);
  };

  return (
    <aside aria-label={tr("BuddyBudget Pro")} className={cn("relative flex flex-col gap-4 rounded-2xl bg-card p-5 pr-12 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-heading text-lg font-semibold leading-snug">{tr(title)}</p>
        <p className="max-w-[60ch] text-sm text-text-2">{tr(text)}</p>
      </div>
      <Link
        href={upsell.href}
        onClick={() => track("pro_nudge_opened", { place })}
        className={cn(buttonVariants({ variant: "sun" }), "h-11 w-fit shrink-0 rounded-full px-5")}
      >
        {upsell.trialAvailable ? tr("Prova {0} giorni gratis", { 0: PRO_TRIAL_DAYS }) : tr("Scopri Pro")}
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label={tr("Non mostrare per ora")}
        className="absolute top-2 right-2 flex size-10 items-center justify-center rounded-full text-text-3 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </aside>
  );
}
