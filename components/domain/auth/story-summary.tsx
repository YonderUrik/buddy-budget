"use client";

/** Riepilogo finale della storia del login: barra delle spese per categoria e numeri che scorrono fino al valore. */

import * as React from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { formatCurrency } from "@/lib/format";
import type { StoryTransaction } from "./login-story.data";
import { STORY_EASE } from "./story-row";

/** Numero che scorre da 0 al valore finale quando viene montato. */
function CountUp({ value, delay }: { value: number; delay: number }) {
  const reduceMotion = useReducedMotion();
  const motionValue = useMotionValue(reduceMotion ? value : 0);
  const text = useTransform(motionValue, (v) => formatCurrency(v, "EUR", { maximumFractionDigits: 0 }));

  React.useEffect(() => {
    if (reduceMotion) {
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, { duration: 1.4, delay, ease: STORY_EASE });
    return () => controls.stop();
  }, [motionValue, value, delay, reduceMotion]);

  return <motion.span className="tabular-nums">{text}</motion.span>;
}

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
      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-primary-foreground/10">
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
          <p className="text-xs text-primary-foreground/60">Speso questo mese</p>
          <p className="font-heading text-3xl font-medium tracking-tight">
            <CountUp value={spent} delay={0.2} />
          </p>
        </div>
        <div>
          <p className="text-xs text-primary-foreground/60">Messo da parte</p>
          <p className="font-heading text-3xl font-medium tracking-tight">
            <CountUp value={saved} delay={0.35} />
          </p>
        </div>
      </div>
    </motion.div>
  );
}
