"use client";

import { useEffect, useState, type ElementType } from "react";
import { eur } from "@/lib/format";
import { MOTION_OK } from "@/lib/motion/gsap";

/** Durata del conteggio (ms), sotto la soglia dei 600 ms dello standard sui numeri animati. */
const COUNTER_MS = 800;
/** Ritardo di default prima che un numero o un testo cambi, così il pannello fa in tempo a comparire. */
const DEFAULT_DELAY_MS = 300;

const FORMAT = {
  eur: (v: number) => eur(v),
  year: (v: number) => String(Math.round(v)),
} as const;

export interface CounterProps {
  from: number;
  to: number;
  format: keyof typeof FORMAT;
  /** Ritardo (ms) dall'accensione del pannello. */
  delay?: number;
  /** Il pannello è in vista: il numero scorre da `from` a `to`; spento torna a `from`. */
  on: boolean;
  className?: string;
}

/** Numero che scorre da un valore all'altro quando il pannello si accende (uscita cubica); con movimento ridotto salta al valore finale. */
export function Counter({ from, to, format, delay = DEFAULT_DELAY_MS, on, className }: CounterProps) {
  const [value, setValue] = useState(from);
  // Quando il pannello si accende o si spegne il numero riparte da `from` (stato derivato, aggiornato durante il render).
  const [wasOn, setWasOn] = useState(on);
  if (on !== wasOn) {
    setWasOn(on);
    setValue(from);
  }

  useEffect(() => {
    if (!on) return;
    const reduced = !window.matchMedia(MOTION_OK).matches;
    let raf = 0;
    const timer = setTimeout(() => {
      if (reduced) {
        setValue(to);
        return;
      }
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / COUNTER_MS);
        const eased = 1 - Math.pow(1 - p, 3);
        setValue(from + (to - from) * eased);
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [on, from, to, delay]);

  return <b className={className}>{FORMAT[format](value)}</b>;
}

export interface SwapProps {
  before: string;
  after: string;
  delay?: number;
  on: boolean;
  as?: ElementType;
  className?: string;
}

/** Testo che, dopo un ritardo dall'accensione del pannello, viene sostituito dalla sua versione «dopo». */
export function Swap({ before, after, delay = DEFAULT_DELAY_MS, on, as: Tag = "b", className }: SwapProps) {
  const [swapped, setSwapped] = useState(false);
  const [wasOn, setWasOn] = useState(on);
  if (on !== wasOn) {
    setWasOn(on);
    setSwapped(false);
  }

  useEffect(() => {
    if (!on) return;
    const timer = setTimeout(() => setSwapped(true), delay);
    return () => clearTimeout(timer);
  }, [on, delay]);

  return <Tag className={className}>{swapped ? after : before}</Tag>;
}
