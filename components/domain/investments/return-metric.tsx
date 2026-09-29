/** Un rendimento in evidenza: etichetta con spiegazione, valore sul periodo e, se ha senso, il valore annuo. */

import type { ReactNode } from "react";
import { InfoHint } from "@/components/domain/shared";
import { cn } from "@/lib/utils";
import { formatSignedPct } from "./gain-text";

export interface ReturnMetricProps {
  label: string;
  /** Spiegazione nel popover "i". */
  hint: ReactNode;
  value: number | null;
  /** Valore annuo equivalente, mostrato solo se non null. */
  annual?: number | null;
  /** Riga sotto il valore (es. l'inflazione usata). */
  note?: string | null;
}

export function ReturnMetric({ label, hint, value, annual = null, note = null }: ReturnMetricProps) {
  return (
    <div className="flex flex-col gap-1">
      <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        {label}
        <InfoHint label={`Cos'è: ${label}`}>{hint}</InfoHint>
      </p>
      <p className={cn("font-heading text-2xl font-medium tabular-nums", value === null ? "text-muted-foreground" : value < 0 ? "text-neg" : "text-pos")}>
        {value === null ? "—" : formatSignedPct(value)}
      </p>
      {annual !== null ? <p className="text-xs tabular-nums text-muted-foreground">{formatSignedPct(annual)} l&apos;anno</p> : null}
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}
