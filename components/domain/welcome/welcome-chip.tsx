"use client";

/**
 * «Dall'ultima visita» as a label beside the Panoramica date, the same place as «Novità»: never interrupts, says the
 * first thing that happened while the user was away, and opens the whole summary (popover, bottom sheet on the phone)
 * with one button per line. Once per visit: the server remembers it was shown; in the open app it stays until a line
 * is followed.
 */

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { useQueryClient } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { buttonVariants } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { useLocalization } from "@/lib/localization/provider";
import { WELCOME_QUERY_KEY, markWelcomeShown, useWelcomeQuery } from "@/lib/queries/welcome";
import type { WelcomeResponse } from "@/lib/welcome";
import { happenedLine, waitingLine, welcomeLabel } from "./welcome-lines";

/** Summaries already reported to the server and to Umami in this page load (keyed by `since`): a remount says nothing new. */
const reported = new Set<string>();

export interface WelcomeChipProps {
  /** Entry delay in seconds, so the label arrives after the greeting. */
  delay?: number;
}

export function WelcomeChip({ delay = 0.6 }: WelcomeChipProps) {
  const { t: tr } = useLocalization();
  const queryClient = useQueryClient();
  const summary = useWelcomeQuery().data?.summary ?? null;
  const happened = React.useMemo(() => summary?.happened.map((item) => happenedLine(item, tr)) ?? [], [summary, tr]);
  const waiting = React.useMemo(() => summary?.waiting.map((item) => waitingLine(item, tr)) ?? [], [summary, tr]);
  const label = welcomeLabel(happened, waiting, tr);
  const counts = { happened: happened.length, waiting: waiting.length };

  React.useEffect(() => {
    if (!summary || !label || reported.has(summary.since)) return;
    reported.add(summary.since);
    track("welcome_summary_shown", { happened: summary.happened.length, waiting: summary.waiting.length });
    markWelcomeShown();
  }, [summary, label]);

  if (!summary || !label) return null;
  return (
    <Popover onOpenChange={(open) => open && track("welcome_summary_opened", counts)}>
      <motion.span
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
        className="inline-flex"
      >
        <PopoverTrigger className="group inline-flex items-center gap-1.5 rounded-full py-0.5 text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden />
          <span className="underline-offset-4 group-hover:underline">{label}</span>
        </PopoverTrigger>
      </motion.span>
      <PopoverContent align="start" className="w-80 gap-3 p-4">
        <PopoverTitle className="font-heading text-base font-medium">{tr("Dall'ultima visita")}</PopoverTitle>
        <ul className="flex flex-col gap-2 text-sm">
          {[...happened, ...waiting].map((line) => (
            <li key={line.kind} className="flex min-h-11 items-center justify-between gap-3">
              <span>
                <span className="font-medium tabular-nums">{line.figure}</span> {line.title}
              </span>
              <Link
                href={line.href}
                className={buttonVariants({ size: "sm", variant: line.action ? "default" : "ghost" })}
                onClick={() => {
                  track("welcome_summary_item_clicked", { item: line.kind });
                  // Followed: the label has done its job for this visit.
                  queryClient.setQueryData<WelcomeResponse>(WELCOME_QUERY_KEY, { summary: null });
                }}
              >
                {line.action ?? tr("Vedi")}
              </Link>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
