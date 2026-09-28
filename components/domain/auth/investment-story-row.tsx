"use client";

/**
 * Riga del capitolo investimenti della storia del login: prima l'operazione grezza del broker con quanto hai pagato,
 * poi lo strumento riconosciuto, col valore che scorre dal prezzo pagato alla chiusura di ieri e il guadagno in %.
 */

import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import type { StoryInvestment } from "./login-story.data";
import { StoryCountUp } from "./story-count-up";
import { STORY_EASE } from "./story-row";

export interface InvestmentStoryRowProps {
  investment: StoryInvestment;
  resolved: boolean;
  /** Attenua la riga quando l'attenzione passa al riepilogo. */
  dimmed: boolean;
}

function gainPercent(cost: number, value: number): string {
  const ratio = (value - cost) / cost;
  return `${ratio < 0 ? "−" : "+"}${Math.abs(ratio * 100).toFixed(1).replace(".", ",")}%`;
}

export function InvestmentStoryRow({ investment, resolved, dimmed }: InvestmentStoryRowProps) {
  const losing = investment.value < investment.cost;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: dimmed ? 0.45 : 1, x: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
      transition={{ duration: 0.5, ease: STORY_EASE }}
      className="relative h-12 overflow-hidden border-b border-sidebar-foreground/10 last:border-b-0"
    >
      <AnimatePresence mode="wait" initial={false}>
        {resolved ? (
          <motion.div
            key="clean"
            initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.45, ease: STORY_EASE }}
            className="flex h-full items-center gap-3 px-4"
          >
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 500, damping: 24 }}
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: `var(${investment.swatchVar})` }}
            />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{investment.name}</span>
            <motion.span
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15, duration: 0.4, ease: STORY_EASE }}
              className="hidden rounded-full px-2 py-0.5 text-xs text-sidebar-foreground xl:inline"
              style={{ backgroundColor: `color-mix(in oklch, var(${investment.swatchVar}) 35%, transparent)` }}
            >
              {investment.kind}
            </motion.span>
            <span className="flex w-24 shrink-0 flex-col items-end leading-tight">
              <span className="font-heading text-sm">
                <StoryCountUp from={investment.cost} value={investment.value} delay={0.2} duration={1.2} />
              </span>
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9, duration: 0.4 }}
                className={cn("text-[11px] tabular-nums", losing ? "text-neg" : "text-pos")}
              >
                {gainPercent(investment.cost, investment.value)}
              </motion.span>
            </span>
          </motion.div>
        ) : (
          <motion.div
            key="raw"
            exit={{ opacity: 0, y: -8, filter: "blur(6px)" }}
            transition={{ duration: 0.3, ease: STORY_EASE }}
            className="flex h-full items-center gap-3 px-4 font-mono text-[12px] uppercase tracking-tight text-sidebar-foreground/55"
          >
            <span className="min-w-0 flex-1 truncate">{investment.raw}</span>
            <span className="w-24 shrink-0 text-right tabular-nums">{investment.cost.toFixed(2)}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}
