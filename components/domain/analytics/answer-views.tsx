"use client";

/**
 * Le quattro risposte (strada fatta, arrivo, regge, costi) come schede con un numero: scegliere una cambia il grafico sotto.
 * Sono il «sommario» di Analitiche: i numeri si aggiornano con i cursori.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import type { AnalyticsQuestion } from "./analytics-questions";

export interface AnswerView {
  id: AnalyticsQuestion["id"];
  /** Etichetta breve. */
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Il numero della risposta, già formattato. */
  value: string;
  /** Una riga sotto il numero. */
  note: string;
}

export interface AnswerViewsProps {
  views: readonly AnswerView[];
  selected: AnswerView["id"];
  onSelect: (id: AnswerView["id"]) => void;
  /** Id del pannello che le schede controllano. */
  panelId: string;
}

export function AnswerViews({ views, selected, onSelect, panelId }: AnswerViewsProps) {
  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = views[(index + step + views.length) % views.length];
    onSelect(next.id);
    document.getElementById(`answer-tab-${next.id}`)?.focus();
  };
  return (
    <div role="tablist" aria-label="Le quattro risposte" className="grid grid-cols-2 border-b lg:grid-cols-4">
      {views.map((v, i) => {
        const on = v.id === selected;
        return (
          <button
            key={v.id}
            id={`answer-tab-${v.id}`}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls={panelId}
            tabIndex={on ? 0 : -1}
            onClick={() => onSelect(v.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "-mb-px flex min-h-11 flex-col items-start gap-0.5 border-b-2 py-3 pr-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
              on ? "border-primary" : "border-transparent hover:border-border"
            )}
          >
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <v.icon className="size-4" aria-hidden="true" />
              {v.label}
            </span>
            <span className="font-heading text-2xl font-medium tabular-nums text-foreground sm:text-3xl">{v.value}</span>
            <span className="text-xs text-muted-foreground">{v.note}</span>
          </button>
        );
      })}
    </div>
  );
}
