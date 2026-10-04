"use client";

/**
 * «Guida passo passo» in cima a ogni scheda: i passi numerati spiegano, con i numeri dell'utente, che cosa si sta
 * guardando e come leggerlo. Si apre da sola finché non la chiudi; lo stato è ricordato per scheda.
 */

import { ChevronRight, ListOrdered } from "lucide-react";
import { track } from "@/lib/analytics";
import { usePersistedFlag } from "@/lib/hooks/use-persisted-flag";
import { Card, CardContent } from "@/components/ui/card";
import type { ReadingStep } from "./guided-steps";

/** Prefisso della chiave localStorage con lo stato aperto/chiuso della guida di ogni scheda. */
export const GUIDED_READING_STORAGE_PREFIX = "analytics-reading:";

export interface GuidedReadingProps {
  /** Identificativo stabile della scheda (chiave dello stato ricordato e dell'evento). */
  tab: string;
  steps: ReadingStep[];
}

export function GuidedReading({ tab, steps }: GuidedReadingProps) {
  const [open, setOpen] = usePersistedFlag(`${GUIDED_READING_STORAGE_PREFIX}${tab}`, true);
  if (steps.length === 0) return null;
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="flex flex-col gap-3">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => {
            track("analytics_reading_toggled", { tab, state: open ? "chiusa" : "aperta" });
            setOpen(!open);
          }}
          className="flex items-center gap-2 text-left text-sm font-semibold text-foreground"
        >
          <ListOrdered className="size-4 text-primary" aria-hidden="true" />
          Guida passo passo a questa analisi
          <span className="font-normal text-muted-foreground">· {steps.length} passi</span>
          <ChevronRight className={`ml-auto size-4 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} aria-hidden="true" />
        </button>
        {open ? (
          <ol className="flex flex-col gap-4">
            {steps.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground" aria-hidden="true">
                  {index + 1}
                </span>
                <div className="flex flex-col gap-1 text-sm leading-relaxed text-muted-foreground">
                  <h3 className="font-medium text-foreground">{step.title}</h3>
                  {step.text.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        ) : null}
      </CardContent>
    </Card>
  );
}
