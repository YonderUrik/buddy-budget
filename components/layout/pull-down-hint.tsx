"use client";

/**
 * PullDownHint
 *
 * What the user sees while pulling the page down (see `usePullDown`): a glass pill with the action's icon and name
 * comes down under the top bar with the finger, fading in, and fills in once letting go would open it. Phone only;
 * nothing is drawn while idle.
 */

import { useReducedMotion } from "motion/react";
import { useLocalization } from "@/lib/localization/provider";
import { cn } from "@/lib/utils";
import { PULL_THRESHOLD_PX } from "./use-pull-down";

export interface PullDownHintProps {
  /** Damped travel from `usePullDown` (px). */
  distance: number;
  /** Italian source key of the action, e.g. «Cerca». */
  label: string;
  icon: React.ElementType;
}

/** How much of the travel the pill follows (the rest is the page's own bounce). */
const HINT_FOLLOW = 0.6;

export function PullDownHint({ distance, label, icon: Icon }: PullDownHintProps) {
  const { t: tr } = useLocalization();
  const reduced = useReducedMotion() ?? false;
  if (distance <= 0) return null;
  const progress = Math.min(1, distance / PULL_THRESHOLD_PX);
  const armed = progress >= 1;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center md:hidden"
      style={{
        top: "calc(env(safe-area-inset-top) + 3.25rem)",
        opacity: progress,
        transform: reduced ? undefined : `translateY(${distance * HINT_FOLLOW}px) scale(${0.86 + 0.14 * progress})`,
      }}
    >
      <span
        className={cn(
          "flex h-10 items-center gap-2 rounded-full border px-4 text-[15px] font-medium transition-colors duration-150",
          armed
            ? "border-transparent bg-foreground text-background"
            : "border-glass-edge bg-glass text-text-2 shadow-[0_8px_24px_-12px_var(--glass-shadow)] backdrop-blur-xl backdrop-saturate-150"
        )}
      >
        <Icon className="size-[18px]" aria-hidden="true" />
        {tr(label)}
      </span>
    </div>
  );
}
