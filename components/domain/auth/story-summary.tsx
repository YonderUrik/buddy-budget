"use client";

/** Riepilogo finale della storia del login: barra delle spese per categoria e numeri che scorrono fino al valore. */

import { motion } from "motion/react";
import type { StoryTransaction } from "./login-story.data";
import { StoryCountUp as CountUp } from "./story-count-up";
import { STORY_EASE } from "./story-row";

export interface StorySummaryProps {
  transactions: StoryTransaction[];
}

export function StorySummary({ transactions }: StorySummaryProps) {
  const expenses = transactions.filter((t) => t.amount < 0);
  const spent = expenses.reduce((sum, t) => sum - t.amount, 0);
  const income = transactions.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
  const saved = income - spent;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
      transition={{ duration: 0.5, ease: STORY_EASE }}
      className="flex flex-col gap-4"
    >
      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-sidebar-foreground/10">
        {expenses.map((t, i) => (
          <motion.span
            key={t.merchant}
            initial={{ width: 0 }}
            animate={{ width: `${(-t.amount / spent) * 100}%` }}
            transition={{ delay: 0.15 + i * 0.12, duration: 0.8, ease: STORY_EASE }}
            className="h-full"
            style={{ backgroundColor: `var(${t.swatchVar})` }}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="text-xs text-sidebar-foreground/60">Speso questo mese</p>
          <p className="font-heading text-3xl font-medium tracking-tight">
            <CountUp value={spent} delay={0.2} />
          </p>
        </div>
        <div>
          <p className="text-xs text-sidebar-foreground/60">Messo da parte</p>
          <p className="font-heading text-3xl font-medium tracking-tight">
            <CountUp value={saved} delay={0.35} />
          </p>
        </div>
      </div>
    </motion.div>
  );
}
