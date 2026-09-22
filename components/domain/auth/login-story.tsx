"use client";

/**
 * LoginStory
 *
 * Pannello illustrativo delle pagine di autenticazione: racconta in loop cosa fa BuddyBudget con i dati di
 * esempio — i movimenti arrivano grezzi dalla banca (Collega), diventano leggibili e categorizzati (Capisci),
 * si riassumono in quanto hai speso e messo da parte (Decidi). Con `prefers-reduced-motion` mostra lo stato
 * finale fermo. L'animazione è decorativa: il contenuto è descritto a parole per gli screen reader.
 */

import { AnimatePresence, MotionConfig, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { STORY_TRANSACTIONS } from "./login-story.data";
import { StoryRow } from "./story-row";
import { StoryStepper } from "./story-stepper";
import { StorySummary } from "./story-summary";
import { useStoryTimeline } from "./use-story-timeline";

export interface LoginStoryProps {
  className?: string;
}

export function LoginStory({ className }: LoginStoryProps) {
  const { phase, arrived, resolved, cycle } = useStoryTimeline(STORY_TRANSACTIONS.length);
  const reduceMotion = useReducedMotion() ?? false;
  const visible = STORY_TRANSACTIONS.slice(0, arrived);

  return (
    <div className={cn("flex w-full max-w-md flex-col gap-6", className)}>
      <p className="sr-only">
        Esempio: BuddyBudget importa i movimenti della banca, li ripulisce e li categorizza, poi mostra quanto hai
        speso e quanto hai messo da parte.
      </p>

      <MotionConfig reducedMotion="user">
        <div aria-hidden="true" className="flex flex-col gap-6">
          <StoryStepper phase={phase} cycle={cycle} static={reduceMotion} />

          <div className="overflow-hidden rounded-xl border border-primary-foreground/15 bg-primary-foreground/[0.04]">
            <div className="flex items-center justify-between border-b border-primary-foreground/10 px-4 py-2 text-xs text-primary-foreground/50">
              <span>Conto corrente</span>
              <span>dati di esempio</span>
            </div>
            {/* Altezza fissa: le righe entrano ed escono senza spostare il resto del pannello. */}
            <ul className="h-60">
              <AnimatePresence>
                {visible.map((t, i) => (
                  <StoryRow
                    key={`${cycle}-${t.merchant}`}
                    transaction={t}
                    resolved={i < resolved}
                    dimmed={phase === "decidi"}
                  />
                ))}
              </AnimatePresence>
            </ul>
          </div>

          <div className="h-28">
            <AnimatePresence mode="wait">
              {phase === "decidi" && <StorySummary key={cycle} transactions={STORY_TRANSACTIONS} />}
            </AnimatePresence>
          </div>
        </div>
      </MotionConfig>
    </div>
  );
}
