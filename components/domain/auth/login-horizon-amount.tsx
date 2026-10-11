"use client";

/** Importo in evidenza del login: parte intera che scorre verso il valore, con ",00 €" attenuato come nella Panoramica. */

import * as React from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { STORY_EASE } from "./story-motion";

const AMOUNT_FORMAT = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 });
const AMOUNT_DURATION_S = 1.4;

export interface LoginHorizonAmountProps {
  value: number;
  className?: string;
}

export function LoginHorizonAmount({ value, className }: LoginHorizonAmountProps) {
  const reduceMotion = useReducedMotion();
  const motionValue = useMotionValue(reduceMotion ? value : 0);
  const text = useTransform(motionValue, (v) => AMOUNT_FORMAT.format(Math.round(v)));

  React.useEffect(() => {
    if (reduceMotion) {
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, { duration: AMOUNT_DURATION_S, ease: STORY_EASE });
    return () => controls.stop();
  }, [motionValue, value, reduceMotion]);

  return (
    <p className={className}>
      <motion.span className="tabular-nums">{text}</motion.span>
      <span className="text-[0.55em] text-text-3">,00 €</span>
    </p>
  );
}
