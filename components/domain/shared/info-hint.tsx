"use client";

/** Icona "i" che apre una breve spiegazione in popover: funziona anche su touch, a differenza del `title` nativo. */

import type { ReactNode } from "react";
import { InfoIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface InfoHintProps {
  /** Testo della spiegazione. */
  children: ReactNode;
  /** Etichetta accessibile del bottone (es. "Cosa sono le uscite escluse?"). */
  label: string;
}

export function InfoHint({ children, label }: InfoHintProps) {
  return (
    <Popover>
      <PopoverTrigger
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={label}
      >
        <InfoIcon className="size-3.5" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent className="max-w-72 text-sm leading-relaxed text-muted-foreground">{children}</PopoverContent>
    </Popover>
  );
}
