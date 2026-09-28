"use client";

/**
 * LoginStory
 *
 * Pannello illustrativo delle pagine di autenticazione: racconta in loop, con dati di esempio, due capitoli a turno.
 * Movimenti: arrivano grezzi dalla banca (Collega), diventano leggibili e categorizzati (Capisci), si riassumono in
 * quanto hai speso e messo da parte (Decidi). Investimenti: le operazioni del broker (Registra) diventano strumenti
 * col valore della chiusura di ieri (Segui), poi quanto hai messo e quanto ha aggiunto il mercato (Capisci).
 * Stesso riquadro e stessi tempi per entrambi, così il pannello non cambia altezza. Con `prefers-reduced-motion`
 * mostra lo stato finale del primo capitolo, fermo. L'animazione è decorativa: il contenuto è descritto a parole per
 * gli screen reader.
 */

import { AnimatePresence, MotionConfig, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import {
  INVESTMENT_STORY_STEPS,
  STORY_CHAPTERS,
  STORY_INVESTMENTS,
  STORY_STEPS,
  STORY_TRANSACTIONS,
} from "./login-story.data";
import { InvestmentStoryRow } from "./investment-story-row";
import { InvestmentStorySummary } from "./investment-story-summary";
import { StoryRow } from "./story-row";
import { StoryStepper } from "./story-stepper";
import { StorySummary } from "./story-summary";
import { useStoryTimeline } from "./use-story-timeline";

/** Righe per capitolo: i due capitoli devono averne lo stesso numero, perché condividono la timeline. */
const STORY_ROW_COUNT = STORY_TRANSACTIONS.length;

const CHAPTER_CARD_LABEL = {
  movimenti: "Conto corrente",
  investimenti: "Portafoglio",
} as const;

export interface LoginStoryProps {
  className?: string;
}

export function LoginStory({ className }: LoginStoryProps) {
  const { phase, arrived, resolved, cycle } = useStoryTimeline(STORY_ROW_COUNT);
  const reduceMotion = useReducedMotion() ?? false;
  const chapter = STORY_CHAPTERS[cycle % STORY_CHAPTERS.length];
  const isInvestments = chapter === "investimenti";
  const dimmed = phase === "decidi";

  return (
    <div className={cn("flex w-full max-w-md flex-col gap-6", className)}>
      <p className="sr-only">
        Esempio: BuddyBudget importa i movimenti della banca, li ripulisce e li categorizza, poi mostra quanto hai
        speso e quanto hai messo da parte. Segue anche i tuoi investimenti: dalle operazioni registrate calcola il
        valore con i prezzi di chiusura e mostra quanto hai messo e quanto ha aggiunto il mercato.
      </p>

      <MotionConfig reducedMotion="user">
        <div aria-hidden="true" className="flex flex-col gap-6">
          <StoryStepper
            phase={phase}
            cycle={cycle}
            static={reduceMotion}
            steps={isInvestments ? INVESTMENT_STORY_STEPS : STORY_STEPS}
          />

          <div className="overflow-hidden rounded-xl border border-sidebar-foreground/15 bg-sidebar-foreground/[0.04]">
            <div className="flex items-center justify-between border-b border-sidebar-foreground/10 px-4 py-2 text-xs text-sidebar-foreground/60">
              <span>{CHAPTER_CARD_LABEL[chapter]}</span>
              <span>dati di esempio</span>
            </div>
            {/* Altezza fissa: le righe entrano ed escono senza spostare il resto del pannello. */}
            <ul className="h-60">
              <AnimatePresence>
                {isInvestments
                  ? STORY_INVESTMENTS.slice(0, arrived).map((inv, i) => (
                      <InvestmentStoryRow key={`${cycle}-${inv.raw}`} investment={inv} resolved={i < resolved} dimmed={dimmed} />
                    ))
                  : STORY_TRANSACTIONS.slice(0, arrived).map((t, i) => (
                      <StoryRow key={`${cycle}-${t.merchant}`} transaction={t} resolved={i < resolved} dimmed={dimmed} />
                    ))}
              </AnimatePresence>
            </ul>
          </div>

          <div className="h-28">
            <AnimatePresence mode="wait">
              {phase === "decidi" &&
                (isInvestments ? (
                  <InvestmentStorySummary key={cycle} investments={STORY_INVESTMENTS} />
                ) : (
                  <StorySummary key={cycle} transactions={STORY_TRANSACTIONS} />
                ))}
            </AnimatePresence>
          </div>
        </div>
      </MotionConfig>
    </div>
  );
}
