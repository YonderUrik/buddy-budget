"use client";

/**
 * Contenuto di una domanda di Analitiche (risposta a parole, immagine) e, in fondo, i dettagli tecnici «Per esperti»
 * (montati solo quando si aprono). Il titolo della domanda è la voce attiva delle schede di risposta: qui resta per i lettori di schermo.
 */

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { track } from "@/lib/analytics";
import type { AnalyticsQuestion } from "./analytics-questions";

export interface QuestionSectionProps {
  question: AnalyticsQuestion;
  /** Cosa contiene la parte tecnica, in una riga (es. «sensibilità, Coast FIRE»). */
  expertHint: string;
  /** Contenuto tecnico: funzione, così non viene calcolato finché la sezione è chiusa. */
  renderExpert: () => React.ReactNode;
  /** Risposta in parole semplici e immagine. */
  children: React.ReactNode;
}

export function QuestionSection({ question, expertHint, renderExpert, children }: QuestionSectionProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <section id={question.id} aria-labelledby={`${question.id}-title`} className="flex flex-col gap-5">
      <h2 id={`${question.id}-title`} className="sr-only">
        {question.title}
      </h2>
      {children}
      <details
        className="group border-t pt-3"
        onToggle={(event) => {
          const next = (event.currentTarget as HTMLDetailsElement).open;
          setOpen(next);
          track("analytics_expert_toggled", { question: question.id, state: next ? "aperta" : "chiusa" });
        }}
      >
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-muted-foreground marker:hidden">
          <ChevronRight className="size-4 shrink-0 transition-transform group-open:rotate-90" aria-hidden="true" />
          <span>
            Per esperti <span className="font-normal">· {expertHint}</span>
          </span>
        </summary>
        {open ? <div className="pt-3">{renderExpert()}</div> : null}
      </details>
    </section>
  );
}
