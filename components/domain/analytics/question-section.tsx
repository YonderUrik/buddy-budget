"use client";

/**
 * Una domanda di Analitiche: titolo, risposta in parole semplici, un'immagine che la mostra e, in fondo,
 * i dettagli tecnici «Per esperti» (montati solo quando si aprono).
 */

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { track } from "@/lib/analytics";
import type { AnalyticsQuestion } from "./analytics-questions";

export interface QuestionSectionProps {
  question: AnalyticsQuestion;
  /** Numero d'ordine (1-based). */
  index: number;
  /** Cosa contiene la parte tecnica, in una riga (es. «sensibilità, Coast FIRE»). */
  expertHint: string;
  /** Contenuto tecnico: funzione, così non viene calcolato finché la sezione è chiusa. */
  renderExpert: () => React.ReactNode;
  /** Risposta in parole semplici e immagine. */
  children: React.ReactNode;
}

export function QuestionSection({ question, index, expertHint, renderExpert, children }: QuestionSectionProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <section id={question.id} aria-labelledby={`${question.id}-title`} className="flex scroll-mt-16 flex-col gap-4 border-b pb-8 last:border-b-0 lg:scroll-mt-6">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-primary">Domanda {index}</span>
        <h2 id={`${question.id}-title`} className="font-heading text-2xl font-medium leading-tight text-foreground">
          {question.title}
        </h2>
      </div>
      {children}
      <details
        className="group rounded-xl border bg-card"
        onToggle={(event) => {
          const next = (event.currentTarget as HTMLDetailsElement).open;
          setOpen(next);
          track("analytics_expert_toggled", { question: question.id, state: next ? "aperta" : "chiusa" });
        }}
      >
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground marker:hidden">
          <ChevronRight className="size-4 shrink-0 transition-transform group-open:rotate-90" aria-hidden="true" />
          <span>
            Per esperti <span className="font-normal">· {expertHint}</span>
          </span>
        </summary>
        {open ? <div className="border-t p-4">{renderExpert()}</div> : null}
      </details>
    </section>
  );
}
