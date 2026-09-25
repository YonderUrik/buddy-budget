"use client";

/** Riga della storia del login: mostra il testo grezzo della banca e, una volta "risolta", il movimento pulito e categorizzato. */

import { AnimatePresence, motion } from "motion/react";
import { formatCurrency } from "@/lib/format";
import type { StoryTransaction } from "./login-story.data";

/** Curva di uscita esponenziale usata da tutta la storia. */
export const STORY_EASE = [0.16, 1, 0.3, 1] as const;

export interface StoryRowProps {
  transaction: StoryTransaction;
  resolved: boolean;
  /** Attenua la riga (fase "decidi", quando l'attenzione passa al riepilogo). */
  dimmed: boolean;
}

export function StoryRow({ transaction, resolved, dimmed }: StoryRowProps) {
  const isIncome = transaction.amount > 0;
  const amountLabel = `${isIncome ? "+" : ""}${formatCurrency(transaction.amount, "EUR")}`;

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
              style={{ backgroundColor: `var(${transaction.swatchVar})` }}
            />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{transaction.merchant}</span>
            <motion.span
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15, duration: 0.4, ease: STORY_EASE }}
              className="hidden rounded-full px-2 py-0.5 text-xs text-sidebar-foreground xl:inline"
              style={{ backgroundColor: `color-mix(in oklch, var(${transaction.swatchVar}) 35%, transparent)` }}
            >
              {transaction.category}
            </motion.span>
            <span className="w-24 shrink-0 text-right font-heading text-sm tabular-nums">{amountLabel}</span>
          </motion.div>
        ) : (
          <motion.div
            key="raw"
            exit={{ opacity: 0, y: -8, filter: "blur(6px)" }}
            transition={{ duration: 0.3, ease: STORY_EASE }}
            className="flex h-full items-center gap-3 px-4 font-mono text-[12px] uppercase tracking-tight text-sidebar-foreground/55"
          >
            <span className="min-w-0 flex-1 truncate">{transaction.raw}</span>
            <span className="w-24 shrink-0 text-right tabular-nums">{transaction.amount.toFixed(2)}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}
