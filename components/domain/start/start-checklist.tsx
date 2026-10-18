"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * «Primi passi» in Panoramica: the next step stands alone in a filled block with one main action (and, for a user with
 * nothing yet, the sample data beside it); the other steps follow as a short list that ticks itself as data arrives.
 * A step just done is acknowledged on top. Presentational: state and callbacks come from props.
 */

import Link from "next/link";
import { CheckIcon, XIcon } from "lucide-react";
import { SECTION_TITLE } from "@/components/domain/shared";
import { Button, buttonVariants } from "@/components/ui/button";
import { START_STEPS, countDoneSteps, nextStartStep, type StartStepDef, type StartStepId } from "@/lib/start";
import { cn } from "@/lib/utils";

/** Where a step's action was pressed (goes into `start_step_clicked`). */
export type StartStepPlacement = "hero" | "list";

/** «Explore with sample data» offered next to the first step. */
export interface StartDemoOption {
  onStart: () => void;
  pending?: boolean;
  errorMessage?: string | null;
}

export interface StartChecklistProps {
  /** Which steps are done. */
  steps: Record<StartStepId, boolean>;
  /** The steps this user is asked for, in order. */
  stepIds: readonly StartStepId[];
  /** Step texts and links (default: the app's, already adapted to the country by the caller). */
  definitions?: readonly StartStepDef[];
  /** Steps done since the last visit: acknowledged in one line above the next step. */
  justDone?: readonly StartStepId[];
  /** Sample data offer; shown only while nothing real exists. */
  demo?: StartDemoOption;
  onStepClick?: (step: StartStepId, placement: StartStepPlacement) => void;
  /** Opens the «Cosa vuoi tenere sotto controllo?» sheet. */
  onChangeFocus?: () => void;
  onDismiss?: () => void;
  dismissing?: boolean;
  className?: string;
}

export function StartChecklist({
  steps,
  stepIds,
  definitions = START_STEPS,
  justDone = [],
  demo,
  onStepClick,
  onChangeFocus,
  onDismiss,
  dismissing,
  className,
}: StartChecklistProps) {
  const { t: tr } = useLocalization();
  const byId = new Map(definitions.map((d) => [d.id, d]));
  const list = stepIds.map((id) => byId.get(id)).filter((d): d is StartStepDef => d != null);
  const done = countDoneSteps(steps, stepIds);
  const nextId = nextStartStep(steps, stepIds);
  const next = nextId ? byId.get(nextId) : undefined;
  const rest = list.filter((d) => d.id !== nextId);
  const acknowledged = justDone.map((id) => byId.get(id)?.done).filter((t): t is string => Boolean(t));

  return (
    <section aria-labelledby="start-checklist" className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h2 id="start-checklist" className={SECTION_TITLE}>
            {tr("Primi passi")}
          </h2>
          <p className="mt-1 text-sm text-text-2" role="status">
            {tr("{0} su {1} fatti", { 0: done, 1: list.length })}
          </p>
        </div>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            disabled={dismissing}
            aria-label={tr("Nascondi i primi passi")}
            className="-mr-2 grid size-11 shrink-0 place-items-center rounded-full text-text-2 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
          >
            <XIcon className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {next ? (
        <div className="flex flex-col gap-4 rounded-3xl bg-card p-5 sm:p-7">
          {acknowledged.length > 0 ? (
            <p className="flex items-center gap-2 text-sm font-medium text-pos">
              <CheckIcon className="size-4 shrink-0" aria-hidden="true" />
              {acknowledged.map((t) => tr(t)).join(" · ")}
            </p>
          ) : null}
          <div className="flex flex-col gap-2">
            <p className="text-sm text-text-2">{tr("Prossimo passo")}</p>
            <h3 className="font-display text-[2rem] font-light leading-[0.95] text-foreground sm:text-[2.5rem]">{tr(next.title)}</h3>
            <p className="max-w-[60ch] text-base text-text-2">{tr(next.description)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={next.href}
              onClick={() => onStepClick?.(next.id, "hero")}
              className={cn(buttonVariants({ variant: "sun" }), "h-11 px-5 text-sm")}
            >
              {tr(next.cta)}
            </Link>
            {demo ? (
              <Button variant="ghost" className="h-11 px-4" onClick={demo.onStart} disabled={demo.pending}>
                {demo.pending ? tr("Preparo l'esempio…") : tr("Prima prova con dati d'esempio")}
              </Button>
            ) : null}
          </div>
          {demo?.errorMessage ? (
            <p className="text-sm text-neg" role="alert">
              {demo.errorMessage}
            </p>
          ) : null}
        </div>
      ) : null}

      {rest.length > 0 ? (
        <ol className="flex flex-col">
          {rest.map((step) => {
            const isDone = steps[step.id];
            return (
              <li key={step.id} className="flex items-center gap-3 py-2.5">
                <span
                  className={cn("grid size-7 shrink-0 place-items-center rounded-full border", isDone ? "border-primary bg-primary text-primary-foreground" : "border-border text-transparent")}
                  aria-hidden="true"
                >
                  <CheckIcon className="size-4" />
                </span>
                <span className={cn("min-w-0 flex-1 text-sm", isDone ? "text-text-2 line-through" : "font-medium text-foreground")}>
                  {tr(step.title)}
                  {isDone ? <span className="sr-only"> · {tr("Fatto")}</span> : null}
                </span>
                {isDone ? null : (
                  <Link
                    href={step.href}
                    onClick={() => onStepClick?.(step.id, "list")}
                    className="-mr-2 flex min-h-11 shrink-0 items-center rounded-full px-3 text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {tr(step.cta)}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      ) : null}

      {onChangeFocus ? (
        <div>
          <button
            type="button"
            onClick={onChangeFocus}
            className="-ml-2 flex min-h-11 items-center rounded-full px-2 text-sm text-text-2 underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {tr("Cambia cosa vuoi tenere sotto controllo")}
          </button>
        </div>
      ) : null}
    </section>
  );
}
