"use client";

/** Indice delle domande: colonna fissa su schermi larghi, barra a scorrimento in alto su mobile. Ogni voce porta alla sua sezione. */

import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import type { AnalyticsQuestion } from "./analytics-questions";
import { useActiveSection } from "./use-active-section";

export interface QuestionNavProps {
  questions: readonly AnalyticsQuestion[];
}

export function QuestionNav({ questions }: QuestionNavProps) {
  const ids = questions.map((q) => q.id);
  const active = useActiveSection(ids);
  return (
    <nav
      aria-label="Domande di Analitiche"
      className="sticky top-0 z-10 -mx-4 flex gap-1 overflow-x-auto bg-background/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:top-6 lg:mx-0 lg:flex-col lg:self-start lg:overflow-visible lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
    >
      {questions.map((q, index) => {
        const on = q.id === active;
        return (
          <a
            key={q.id}
            href={`#${q.id}`}
            aria-current={on ? "location" : undefined}
            onClick={() => track("analytics_question_nav", { question: q.id })}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
              on ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className={cn("flex size-5 items-center justify-center rounded-full text-xs font-semibold", on ? "bg-primary text-primary-foreground" : "bg-muted")} aria-hidden="true">
              {index + 1}
            </span>
            {q.label}
          </a>
        );
      })}
    </nav>
  );
}
