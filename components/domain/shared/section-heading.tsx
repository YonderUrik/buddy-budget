"use client";

/**
 * Testata di una sezione con più viste (Liquidità, Investimenti, Pensione). Da `lg` in su: titolo della sezione,
 * sottotitolo e, sotto, il segmentato delle viste (`SectionTabs`). Sotto `lg`: il nome della sezione in piccolo e la
 * vista corrente come titolo «Movimenti ⌄», che apre un foglio dal basso con tutte le viste e le loro descrizioni.
 * Senza viste (`tabs` vuoto) mostra solo titolo e sottotitolo a ogni larghezza.
 */

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";
import { track, type SectionViewsKey } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { activeSectionTabIndex, type SectionTab } from "./section-tabs";
import { SectionViewsSheet } from "./section-views-sheet";

/** Oltre questi caratteri il nome della vista su telefono scende di una taglia, per stare accanto ai pulsanti. */
const LONG_VIEW_LABEL_CHARS = 12;

export interface SectionHeadingProps {
  /** Nome della sezione (es. «Liquidità»). */
  title: string;
  subtitle?: string;
  /** Viste della sezione; vuoto o assente = nessun selettore. */
  tabs?: readonly SectionTab[];
  activeHref: string;
  /** Sezione per gli eventi d'uso del foglio delle viste. */
  analyticsKey: SectionViewsKey;
  /** Classi del titolo da `lg` in su (dimensione del testo). Default: `text-2xl`. */
  titleClassName?: string;
  /** Classi del sottotitolo. */
  subtitleClassName?: string;
}

export function SectionHeading({
  title,
  subtitle,
  tabs = [],
  activeHref,
  analyticsKey,
  titleClassName = "text-2xl",
  subtitleClassName = "text-sm text-text-2",
}: SectionHeadingProps) {
  const [open, setOpen] = React.useState(false);
  const hasViews = tabs.length > 0;
  const activeIndex = activeSectionTabIndex(tabs, activeHref);
  const active = tabs[activeIndex];

  function changeOpen(next: boolean) {
    setOpen(next);
    if (next) track("section_views_opened", { section: analyticsKey });
  }

  return (
    <>
      <div className={cn("min-w-0", hasViews && "max-lg:hidden")}>
        <h1 className={cn("font-heading font-medium tracking-tight text-foreground", titleClassName)}>{title}</h1>
        {subtitle ? <p className={subtitleClassName}>{subtitle}</p> : null}
      </div>
      {hasViews && active ? (
        <div className="min-w-0 flex-1 lg:hidden">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-3">{title}</p>
          <h1>
            <button
              type="button"
              onClick={() => changeOpen(true)}
              aria-haspopup="dialog"
              aria-label={`${active.label}: cambia vista di ${title}`}
              className={cn(
                "-ml-1 flex min-h-11 max-w-full cursor-pointer items-center gap-1.5 rounded-lg px-1 text-left font-heading font-medium tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active.label.length > LONG_VIEW_LABEL_CHARS ? "text-xl" : "text-2xl"
              )}
            >
              <span className="truncate">{active.label}</span>
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-text-2" aria-hidden="true">
                <ChevronDownIcon className="size-4" />
              </span>
            </button>
          </h1>
          <SectionViewsSheet
            open={open}
            onOpenChange={changeOpen}
            title={title}
            tabs={tabs}
            activeIndex={activeIndex}
            onChoose={() => track("section_view_chosen", { section: analyticsKey })}
          />
        </div>
      ) : null}
    </>
  );
}

