"use client";

/** Indicatore delle tre fasi della storia del login: la barra della fase attiva si riempie per tutta la sua durata. */

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { STORY_STEPS, STORY_TIMING, type StoryPhase } from "./login-story.data";
import { STORY_EASE } from "./story-row";

/** Durata di ciascuna fase, in secondi, derivata dalla timeline. */
const PHASE_DURATION_S: Record<StoryPhase, number> = {
  collega: STORY_TIMING.understandStartMs / 1000,
  capisci: (STORY_TIMING.decideStartMs - STORY_TIMING.understandStartMs) / 1000,
  decidi: (STORY_TIMING.cycleMs - STORY_TIMING.decideStartMs) / 1000,
};

export interface StoryStepperProps {
  phase: StoryPhase;
  /** Ciclo corrente: fa ripartire le barre da zero a ogni giro. */
  cycle: number;
  /** Se true le barre sono piene e ferme (reduced motion). */
  static?: boolean;
}

export function StoryStepper({ phase, cycle, static: isStatic = false }: StoryStepperProps) {
  const activeIndex = STORY_STEPS.findIndex((s) => s.id === phase);
  const active = STORY_STEPS[activeIndex];

  return (
    <div className="flex flex-col gap-3">
      <ol className="grid grid-cols-3 gap-3">
        {STORY_STEPS.map((step, index) => (
          <li key={step.id} className="flex flex-col gap-2">
            <span className="relative h-0.5 overflow-hidden rounded-full bg-primary-foreground/15">
              {index <= activeIndex && (
                <motion.span
                  key={`${cycle}-${step.id}`}
                  initial={index === activeIndex && !isStatic ? { scaleX: 0 } : false}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: PHASE_DURATION_S[step.id], ease: "linear" }}
                  className="absolute inset-0 origin-left bg-primary-foreground"
                />
              )}
            </span>
            <span
              className={cn(
                "text-sm font-medium transition-colors duration-300",
                index === activeIndex ? "text-primary-foreground" : "text-primary-foreground/45"
              )}
            >
              {step.label}
            </span>
          </li>
        ))}
      </ol>
      <motion.p
        key={active.id}
        initial={isStatic ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: STORY_EASE }}
        className="text-sm text-primary-foreground/70"
      >
        {active.caption}
      </motion.p>
    </div>
  );
}
