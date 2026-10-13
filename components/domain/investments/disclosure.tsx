"use client";

/**
 * Sezione che si apre su richiesta: riga-bottone con titolo, riassunto e freccia; il contenuto compare sotto solo da
 * aperta. Serve per i dettagli che non servono a colpo d'occhio (da dove vengono i dati, obiettivo, tabella completa).
 */

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DisclosureProps {
  title: string;
  /** Una riga sotto il titolo, visibile anche da chiusa. */
  summary?: React.ReactNode;
  /** Parte a destra del titolo (es. un badge o un conteggio). */
  trailing?: React.ReactNode;
  defaultOpen?: boolean;
  /** Variante senza bordo, per le sezioni dentro una card che ha già il suo titolo. */
  bare?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Disclosure({ title, summary, trailing, defaultOpen = false, bare = false, children, className }: DisclosureProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const panelId = React.useId();
  return (
    <div className={cn(bare ? "" : "rounded-xl border", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
          bare ? "py-1" : "px-4 py-3"
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-foreground">{title}</span>
          {summary ? <span className="block text-sm text-muted-foreground">{summary}</span> : null}
        </span>
        {trailing}
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open ? (
        <div id={panelId} className={cn("flex flex-col gap-3", bare ? "pt-3" : "border-t px-4 py-4")}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
