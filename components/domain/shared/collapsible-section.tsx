"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * Sezione con intestazione cliccabile che si apre e si chiude, con lo stato ricordato tra le visite. Da chiusa può
 * mostrare un riepilogo di una riga (`summary`) accanto al titolo; `action` è un controllo extra a destra
 * dell'intestazione (es. l'occhio "nascondi valori"), fuori dal bottone per non annidare bottoni.
 */

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { usePersistedFlag } from "@/lib/hooks/use-persisted-flag";
import { SIDEBAR_ISLAND_CLASS } from "@/lib/sidebar/island";
import { cn } from "@/lib/utils";

/** Prefisso delle chiavi localStorage con lo stato aperto/chiuso delle sezioni. */
export const COLLAPSIBLE_STORAGE_PREFIX = "section-open:";

export interface CollapsibleSectionProps {
  /** Identificativo stabile: chiave dello stato ricordato. */
  id: string;
  title: string;
  defaultOpen?: boolean;
  /** Riepilogo mostrato solo a sezione chiusa. */
  summary?: React.ReactNode;
  /** Etichetta o badge accanto al titolo, sempre visibile. */
  badge?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** `card`: the section is its own island of the desktop sidebar, with a stronger title; `rule` (default): a line above. */
  variant?: "rule" | "card";
}

export function CollapsibleSection({
  id,
  title,
  defaultOpen = true,
  summary,
  badge,
  action,
  children,
  className,
  variant = "rule",
}: CollapsibleSectionProps) {
  const { t: tr } = useLocalization();
  const [open, setOpen] = usePersistedFlag(`${COLLAPSIBLE_STORAGE_PREFIX}${id}`, defaultOpen);
  const panelId = React.useId();
  return (
    <section
      className={cn(variant === "card" ? cn(SIDEBAR_ISLAND_CLASS, "p-2") : "border-t border-sidebar-border pt-2", className)}
      aria-label={tr(title)}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls={panelId}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left",
            variant === "card"
              ? "text-sm font-semibold text-sidebar-foreground"
              : "text-xs font-medium text-sidebar-foreground/60 transition-colors hover:text-sidebar-foreground"
          )}
        >
          <ChevronRight
            className={cn("size-3 shrink-0 transition-transform duration-150", open && "rotate-90")}
            aria-hidden="true"
          />
          <span className="truncate">{tr(title)}</span>
          {badge}
          {!open && summary ? (
            <span className="ml-auto truncate pl-2 text-xs font-medium normal-case tracking-normal text-sidebar-foreground">
              {summary}
            </span>
          ) : null}
        </button>
        {action}
      </div>
      <div id={panelId} hidden={!open} className="pb-1">
        {children}
      </div>
    </section>
  );
}
