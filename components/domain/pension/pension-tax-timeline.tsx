"use client";

/**
 * Linea del tempo dell'aliquota in uscita: 15% fino a 15 anni dall'adesione, poi scende fino al 9% a 35 anni.
 * Il chip mostra l'aliquota dell'anno scelto (di default oggi); se `onYearsChange` è passato si può trascinare, o
 * muovere con le frecce, per simulare un altro anno senza salvare nulla.
 */

import * as React from "react";
import { EXIT_TAX_TIMELINE_YEARS, exitTaxMilestones, exitTaxRate } from "@/lib/calc/pension";
import { formatPercent } from "./pension-format";

export interface PensionTaxTimelineProps {
  adhesionDate: string;
  /** Anni di partecipazione mostrati dal chip. */
  years: number;
  /** Anni reali di oggi: resta un segno sulla barra quando il chip viene spostato. */
  realYears: number;
  /** Se presente il chip è interattivo (trascinamento e tastiera). */
  onYearsChange?: (years: number) => void;
  /** Fine di un gesto (rilascio o ultimo tasto): serve per registrare l'uso una volta sola. */
  onCommit?: () => void;
  /** Escape sul chip: torna al valore reale. */
  onReset?: () => void;
}

const FLAT_YEARS = 15;
const KEY_STEP = 1;
const KEY_PAGE_STEP = 5;

function clampYears(value: number): number {
  return Math.min(EXIT_TAX_TIMELINE_YEARS, Math.max(0, Math.round(value)));
}

export function PensionTaxTimeline({ adhesionDate, years, realYears, onYearsChange, onCommit, onReset }: PensionTaxTimelineProps) {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const dragging = React.useRef(false);
  const changed = React.useRef(false);
  const milestones = exitTaxMilestones(adhesionDate);
  const interactive = Boolean(onYearsChange);
  const shownYears = clampYears(years);
  const position = (shownYears / EXIT_TAX_TIMELINE_YEARS) * 100;
  const realPosition = (Math.min(EXIT_TAX_TIMELINE_YEARS, realYears) / EXIT_TAX_TIMELINE_YEARS) * 100;
  const flatShare = (FLAT_YEARS / EXIT_TAX_TIMELINE_YEARS) * 100;
  const startYear = Number(adhesionDate.slice(0, 4));
  const rateLabel = formatPercent(exitTaxRate(shownYears), 1);
  const marks = [
    { left: 0, title: String(startYear), caption: "Adesione" },
    { left: flatShare, title: milestones.reductionStartsOn.slice(0, 4), caption: "Inizia a scendere" },
    { left: 100, title: milestones.minRateOn.slice(0, 4), caption: "Minimo" },
  ];

  const update = (next: number) => {
    changed.current = true;
    onYearsChange?.(clampYears(next));
  };
  const fromPointer = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    update(((clientX - rect.left) / rect.width) * EXIT_TAX_TIMELINE_YEARS);
  };
  const finish = () => {
    dragging.current = false;
    if (changed.current) onCommit?.();
    changed.current = false;
  };
  const onKeyDown = (event: React.KeyboardEvent) => {
    const steps: Record<string, number> = { ArrowRight: KEY_STEP, ArrowUp: KEY_STEP, ArrowLeft: -KEY_STEP, ArrowDown: -KEY_STEP, PageUp: KEY_PAGE_STEP, PageDown: -KEY_PAGE_STEP };
    if (event.key in steps) update(shownYears + steps[event.key]);
    else if (event.key === "Home") update(0);
    else if (event.key === "End") update(EXIT_TAX_TIMELINE_YEARS);
    else if (event.key === "Escape" && onReset) onReset();
    else return;
    event.preventDefault();
  };

  const chipClass = "rounded-md bg-foreground px-1.5 py-0.5 text-xs font-medium tabular-nums text-background";
  return (
    <div className="flex flex-col gap-3">
      <div ref={trackRef} className="relative pt-6">
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-foreground/10">
          <span className="h-full bg-neg/70" style={{ width: `${flatShare}%` }} />
          <span className="h-full bg-gradient-to-r from-neg/70 to-pos" style={{ width: `${100 - flatShare}%` }} />
        </div>
        {interactive && shownYears !== realYears ? (
          <span className="absolute bottom-0 h-3 w-0.5 -translate-x-1/2 rounded-full bg-foreground/40" style={{ left: `${realPosition}%` }} title="Oggi" aria-hidden="true" />
        ) : null}
        <div className="absolute top-0 -translate-x-1/2" style={{ left: `${position}%` }}>
          <div className="flex flex-col items-center">
            {interactive ? (
              <span
                role="slider"
                tabIndex={0}
                aria-label="Anni di partecipazione al fondo, per simulare l'aliquota in uscita"
                aria-valuemin={0}
                aria-valuemax={EXIT_TAX_TIMELINE_YEARS}
                aria-valuenow={shownYears}
                aria-valuetext={`${shownYears} anni di partecipazione, aliquota ${rateLabel}`}
                className={`${chipClass} relative cursor-grab touch-none select-none outline-none before:absolute before:-inset-2 before:content-[''] focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing`}
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  dragging.current = true;
                }}
                onPointerMove={(event) => {
                  if (dragging.current) fromPointer(event.clientX);
                }}
                onPointerUp={finish}
                onPointerCancel={finish}
                onKeyDown={onKeyDown}
                onKeyUp={(event) => {
                  if (event.key !== "Escape" && changed.current) finish();
                }}
              >
                {rateLabel}
              </span>
            ) : (
              <span className={chipClass}>{rateLabel}</span>
            )}
            <span className="h-3 w-px bg-foreground" aria-hidden="true" />
          </div>
        </div>
      </div>
      <ul className="relative h-9 text-xs text-text-2">
        {marks.map((mark) => (
          <li key={mark.title} className="absolute flex -translate-x-1/2 flex-col items-center whitespace-nowrap first:translate-x-0 first:items-start last:-translate-x-full last:items-end" style={{ left: `${mark.left}%` }}>
            <span className="font-medium tabular-nums text-foreground">{mark.title}</span>
            <span>{mark.caption}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
