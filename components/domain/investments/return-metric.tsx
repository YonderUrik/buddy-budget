"use client";

import type { ReactNode } from "react";
import { InfoIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatSignedPct } from "./gain-text";

export interface ReturnMetricProps {
  label: string;
  hint: ReactNode;
  description?: string;
  periodLabel?: string;
  value: number | null;
  annual?: number | null;
  note?: string | null;
}

/** Il riquadro spiega il numero su hover, clic/tocco o attivazione da tastiera. */
export function ReturnMetric({ label, hint, value, annual = null, note = null, description, periodLabel }: ReturnMetricProps) {
  const formatted = value === null ? "Non disponibile" : formatSignedPct(value);
  return <Popover>
    <PopoverTrigger
      openOnHover
      delay={200}
      closeDelay={100}
      aria-label={`${label}: ${formatted}. Mostra la spiegazione`}
      className="flex min-h-40 min-w-0 flex-col items-start gap-1 rounded-lg border bg-muted/20 p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring"
    >
      <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">{label}<InfoIcon className="size-3.5 shrink-0" aria-hidden="true" /></span>
      <span className={cn("font-heading text-2xl font-medium tabular-nums", value === null ? "text-muted-foreground" : value < 0 ? "text-neg" : "text-pos")}>{value === null ? "—" : formatted}</span>
      <span className="text-xs text-muted-foreground">Cumulato nel periodo</span>
      {annual !== null ? <span className="text-xs tabular-nums text-muted-foreground">{formatSignedPct(annual)} annualizzato</span> : null}
      {description ? <span className="text-xs text-muted-foreground">{description}</span> : null}
      {note ? <span className="text-xs text-muted-foreground">{note}</span> : null}
    </PopoverTrigger>
    <PopoverContent align="start" className="max-w-80 text-sm leading-relaxed">
      <p className="font-medium">{label} · {formatted}</p>
      {periodLabel ? <p className="text-xs text-muted-foreground">{periodLabel}</p> : null}
      <div>{hint}</div>
      {value !== null ? <p className="text-xs text-muted-foreground">La percentuale principale è il rendimento complessivo di questo intervallo. Il valore annualizzato, quando presente, è il tasso annuo equivalente.</p> : null}
    </PopoverContent>
  </Popover>;
}
