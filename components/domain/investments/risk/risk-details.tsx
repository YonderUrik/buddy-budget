"use client";

/** Dettaglio a scomparsa (chiuso di default): il contenuto si monta solo da aperto, così i grafici misurano la larghezza giusta. */

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RiskDetailsProps {
  title: string;
  children: React.ReactNode;
}

export function RiskDetails({ title, children }: RiskDetailsProps) {
  const [open, setOpen] = React.useState(false);
  const panelId = React.useId();
  return (
    <div className="border-t pt-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex min-h-11 w-full items-center gap-1.5 rounded-md text-left text-sm font-medium text-foreground hover:text-primary sm:min-h-9"
      >
        <ChevronRight className={cn("size-4 shrink-0 transition-transform duration-150", open && "rotate-90")} aria-hidden="true" />
        {title}
      </button>
      <div id={panelId} hidden={!open} className="pb-1 pt-2">
        {open ? children : null}
      </div>
    </div>
  );
}
