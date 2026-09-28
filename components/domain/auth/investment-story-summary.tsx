"use client";

/**
 * Riepilogo del capitolo investimenti della storia del login: la barra divide il valore tra quanto hai pagato e
 * quanto ha aggiunto il mercato, con i due numeri che scorrono (stessa lettura della pagina Investimenti).
 */

import { motion } from "motion/react";
import type { StoryInvestment } from "./login-story.data";
import { StoryCountUp } from "./story-count-up";
import { STORY_EASE } from "./story-row";

export interface InvestmentStorySummaryProps {
  investments: StoryInvestment[];
  /** Colore della parte "pagato" della barra. */
  paidColor?: string;
  /** Colore della parte "dal mercato" della barra. */
  marketColor?: string;
}

export function InvestmentStorySummary({
  investments,
  paidColor = "var(--swatch-blue)",
  marketColor = "var(--swatch-emerald)",
}: InvestmentStorySummaryProps) {
  const paid = investments.reduce((sum, i) => sum + i.cost, 0);
  const value = investments.reduce((sum, i) => sum + i.value, 0);
  const market = value - paid;
  const marketShare = value > 0 && market > 0 ? market / value : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
      transition={{ duration: 0.5, ease: STORY_EASE }}
      className="flex flex-col gap-4"
    >
      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-sidebar-foreground/10">
        <motion.span
          initial={{ width: 0 }}
          animate={{ width: `${(1 - marketShare) * 100}%` }}
          transition={{ delay: 0.15, duration: 0.8, ease: STORY_EASE }}
          className="h-full"
          style={{ backgroundColor: paidColor }}
        />
        <motion.span
          initial={{ width: 0 }}
          animate={{ width: `${marketShare * 100}%` }}
          transition={{ delay: 0.75, duration: 0.8, ease: STORY_EASE }}
          className="h-full"
          style={{ backgroundColor: marketColor }}
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="text-xs text-sidebar-foreground/60">Hai messo</p>
          <p className="font-heading text-3xl font-medium tracking-tight">
            <StoryCountUp value={paid} delay={0.2} />
          </p>
        </div>
        <div>
          <p className="text-xs text-sidebar-foreground/60">Il mercato ha aggiunto</p>
          <p className="font-heading text-3xl font-medium tracking-tight">
            <StoryCountUp value={market} delay={0.8} signed />
          </p>
        </div>
      </div>
    </motion.div>
  );
}
