"use client";

/**
 * LoginStory
 *
 * Pannello illustrativo delle pagine di autenticazione: racconta in loop, con dati di esempio, due capitoli a turno.
 * Movimenti: arrivano grezzi dalla banca (Collega), diventano leggibili e categorizzati (Capisci), si riassumono in
 * quanto hai speso e messo da parte (Decidi). Investimenti, con un racconto diverso: un grafico che si disegna, prima
 * il versato di un PAC con un punto per ogni versamento (Versa), poi il valore che ci cresce sopra (Cresce), infine quanto ha aggiunto il
 * mercato e la composizione per tipo (Capisci).
 * Stesso riquadro e stessi tempi per entrambi, così il pannello non cambia altezza. Con `prefers-reduced-motion`
 * mostra lo stato finale del primo capitolo, fermo. L'animazione è decorativa: il contenuto è descritto a parole per
 * gli screen reader.
 */

import { AnimatePresence, MotionConfig, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import {
  INVESTMENT_STORY_STEPS,
  PAC_STORY_MONTHLY,
  PAC_STORY_RETURNS,
  STORY_ALLOCATION,
  STORY_CHAPTERS,
  STORY_STEPS,
  STORY_TIMING,
  STORY_TRANSACTIONS,
} from "./login-story.data";
import { PacStoryChart } from "./pac-story-chart";
import { PacStorySummary } from "./pac-story-summary";
import { buildPacSeries } from "./pac-story.utils";
import { StoryRow } from "./story-row";
import { StoryStepper } from "./story-stepper";
import { StorySummary } from "./story-summary";
import { useStoryTimeline } from "./use-story-timeline";

const STORY_ROW_COUNT = STORY_TRANSACTIONS.length;
const PAC_SERIES = buildPacSeries(PAC_STORY_MONTHLY, PAC_STORY_RETURNS);
const PAC_LAST = PAC_SERIES[PAC_SERIES.length - 1];
/** Il disegno di ogni linea occupa la sua fase, con un attimo di respiro prima della fase successiva. */
const PAC_INVESTED_DRAW_S = STORY_TIMING.understandStartMs / 1000 - 0.3;
const PAC_VALUE_DRAW_S = (STORY_TIMING.decideStartMs - STORY_TIMING.understandStartMs) / 1000 - 0.4;

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
        speso e quanto hai messo da parte. Segue anche i tuoi investimenti: per un PAC mostra quanto hai versato mese
        dopo mese, il valore ai prezzi di chiusura, quanto ha aggiunto il mercato e come è diviso il portafoglio.
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
            {/* Altezza fissa: righe e grafico cambiano senza spostare il resto del pannello. */}
            {isInvestments ? (
              <div className="h-60">
                <PacStoryChart
                  key={cycle}
                  series={PAC_SERIES}
                  phase={phase}
                  investedDrawSeconds={PAC_INVESTED_DRAW_S}
                  valueDrawSeconds={PAC_VALUE_DRAW_S}
                />
              </div>
            ) : (
              <ul className="h-60">
                <AnimatePresence>
                  {STORY_TRANSACTIONS.slice(0, arrived).map((t, i) => (
                    <StoryRow key={`${cycle}-${t.merchant}`} transaction={t} resolved={i < resolved} dimmed={dimmed} />
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>

          <div className="h-28">
            <AnimatePresence mode="wait">
              {phase === "decidi" &&
                (isInvestments ? (
                  <PacStorySummary key={cycle} invested={PAC_LAST.invested} value={PAC_LAST.value} allocation={STORY_ALLOCATION} />
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
