"use client";

/**
 * Hook della timeline della storia del login: fa avanzare fase, righe arrivate e righe risolte, in loop.
 * Con `prefers-reduced-motion` restituisce subito lo stato finale, fermo.
 */

import * as React from "react";
import { useReducedMotion } from "motion/react";
import { STORY_TIMING, type StoryPhase } from "./login-story.data";

export interface StoryTimelineState {
  phase: StoryPhase;
  /** Numero di righe arrivate (visibili). */
  arrived: number;
  /** Numero di righe già trasformate da grezze a pulite. */
  resolved: number;
  /** Incrementa a ogni nuovo ciclo: utile come `key` per ripartire da capo. */
  cycle: number;
}

export function useStoryTimeline(rowCount: number): StoryTimelineState {
  const reduceMotion = useReducedMotion();
  const [state, setState] = React.useState<StoryTimelineState>({ phase: "collega", arrived: 0, resolved: 0, cycle: 0 });

  React.useEffect(() => {
    if (reduceMotion) return;

    const timers: number[] = [];
    const at = (ms: number, update: (s: StoryTimelineState) => StoryTimelineState) =>
      timers.push(window.setTimeout(() => setState(update), ms));

    for (let i = 1; i <= rowCount; i++) {
      at(i * STORY_TIMING.rowArrivalMs, (s) => ({ ...s, arrived: i }));
    }
    at(STORY_TIMING.understandStartMs, (s) => ({ ...s, phase: "capisci" }));
    for (let i = 1; i <= rowCount; i++) {
      at(STORY_TIMING.understandStartMs + i * STORY_TIMING.rowResolveMs, (s) => ({ ...s, resolved: i }));
    }
    at(STORY_TIMING.decideStartMs, (s) => ({ ...s, phase: "decidi" }));
    at(STORY_TIMING.cycleMs, (s) => ({ phase: "collega", arrived: 0, resolved: 0, cycle: s.cycle + 1 }));

    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [rowCount, reduceMotion, state.cycle]);

  if (reduceMotion) {
    return { phase: "decidi", arrived: rowCount, resolved: rowCount, cycle: 0 };
  }
  return state;
}
