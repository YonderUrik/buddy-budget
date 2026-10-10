"use client";

/**
 * Checklist «Primi passi» della Panoramica: quattro passi che si spuntano da soli quando i dati ci sono, ciascuno con
 * l'azione per farlo. Si può chiudere. Presentazionale: stato e callback arrivano dalle props.
 */

import Link from "next/link";
import { CheckIcon, ListChecksIcon, XIcon } from "lucide-react";
import { SectionHeading } from "@/components/domain/overview";
import { buttonVariants } from "@/components/ui/button";
import { START_STEPS, countDoneSteps, type StartStepDef, type StartStepId } from "@/lib/start";
import { cn } from "@/lib/utils";

export interface StartChecklistProps {
  /** Quali passi sono fatti. */
  steps: Record<StartStepId, boolean>;
  /** Elenco dei passi (default: quelli dell'app). */
  definitions?: readonly StartStepDef[];
  onStepClick?: (step: StartStepId) => void;
  onDismiss?: () => void;
  dismissing?: boolean;
  className?: string;
}

export function StartChecklist({ steps, definitions = START_STEPS, onStepClick, onDismiss, dismissing, className }: StartChecklistProps) {
  const done = countDoneSteps(steps);
  return (
    <section aria-labelledby="start-checklist" className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <SectionHeading id="start-checklist" icon={ListChecksIcon} title="Primi passi" color="var(--swatch-teal)" />
          <p className="mt-1 text-sm text-text-2" role="status">
            {done === 0 ? "Quattro passi per avere il quadro completo." : `${done} su ${definitions.length} fatti.`}
          </p>
        </div>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            disabled={dismissing}
            aria-label="Nascondi i primi passi"
            className="-mr-2 grid size-11 shrink-0 place-items-center rounded-lg text-text-2 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
          >
            <XIcon className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <ol>
        {definitions.map((step) => {
          const isDone = steps[step.id];
          return (
            <li key={step.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b py-3 last:border-b-0">
              <span
                className={cn("grid size-7 shrink-0 place-items-center rounded-full border", isDone ? "border-primary bg-primary text-primary-foreground" : "border-border text-transparent")}
                aria-hidden="true"
              >
                <CheckIcon className="size-4" />
              </span>
              <span className="min-w-0 flex-1 basis-56">
                <span className={cn("block text-sm font-medium", isDone ? "text-text-2 line-through" : "text-foreground")}>{step.title}</span>
                <span className="block text-sm text-text-2">{step.description}</span>
                {isDone ? <span className="sr-only">Fatto</span> : null}
              </span>
              {isDone ? null : (
                <Link
                  href={step.href}
                  onClick={() => onStepClick?.(step.id)}
                  className={cn(buttonVariants({ variant: "outline" }), "ml-10 h-11 shrink-0 px-3 sm:ml-0")}
                >
                  {step.cta}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
