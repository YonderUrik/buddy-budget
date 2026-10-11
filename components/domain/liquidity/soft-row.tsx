/** Riga morbida (fondo tenue, senza bordo) per cifre e voci; al posto dei riquadri a card. */

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SoftRowProps {
  title: React.ReactNode;
  hint?: React.ReactNode;
  /** Parte a destra (importo, bottone). */
  end?: React.ReactNode;
  /** Parte a sinistra (icona o avatar). */
  start?: React.ReactNode;
  className?: string;
}

export function SoftRow({ title, hint, end, start, className }: SoftRowProps) {
  return (
    <div className={cn("flex min-h-14 items-center gap-3.5 rounded-2xl bg-foreground/[0.04] px-4 py-3", className)}>
      {start}
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{title}</div>
        {hint && <div className="text-sm text-text-2">{hint}</div>}
      </div>
      {end}
    </div>
  );
}
