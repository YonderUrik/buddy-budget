"use client";

/** Numero in euro che scorre da `from` al valore finale quando viene montato (fermo con reduced motion). */

import * as React from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { formatCurrency } from "@/lib/format";
import { STORY_EASE } from "./story-row";

export interface StoryCountUpProps {
  value: number;
  /** Valore di partenza (default 0). */
  from?: number;
  delay?: number;
  duration?: number;
  /** Mostra il segno anche per i positivi ("+427 €"). */
  signed?: boolean;
  /** Andamento costante invece della curva della storia (per seguire un disegno che avanza a velocità fissa). */
  linear?: boolean;
}

export function StoryCountUp({ value, from = 0, delay = 0, duration = 1.4, signed = false, linear = false }: StoryCountUpProps) {
  const reduceMotion = useReducedMotion();
  const motionValue = useMotionValue(reduceMotion ? value : from);
  const text = useTransform(motionValue, (v) => {
    const formatted = formatCurrency(Math.abs(v), "EUR", { maximumFractionDigits: 0 });
    if (v < 0) return `−${formatted}`;
    return signed ? `+${formatted}` : formatted;
  });

  React.useEffect(() => {
    if (reduceMotion) {
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, { duration, delay, ease: linear ? "linear" : STORY_EASE });
    return () => controls.stop();
  }, [motionValue, value, delay, duration, linear, reduceMotion]);

  return <motion.span className="tabular-nums">{text}</motion.span>;
}
