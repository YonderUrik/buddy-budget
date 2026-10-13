"use client";
import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";

import type { ReactNode } from "react";
import { InfoIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";


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
  const { locale: formattingLocale } = useLocalization();
  const { formatSignedPct } = localizedFormats(formattingLocale);

  const { t: tr } = useLocalization();
  const formatted = value === null ? "Non disponibile" : formatSignedPct(value);
  return <Popover>
    <PopoverTrigger
      openOnHover
      delay={200}
      closeDelay={100}
      aria-label={tr("{0}: {1}. Mostra la spiegazione", {0: label, 1: formatted})}
      className="flex min-w-0 flex-col items-start gap-1 rounded-sm text-left transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
    >
      <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">{tr(label)}<InfoIcon className="size-3.5 shrink-0" aria-hidden="true" /></span>
      <span className={cn("font-heading text-2xl font-medium tabular-nums", value === null ? "text-muted-foreground" : value < 0 ? "text-neg" : "text-pos")}>{value === null ? "—" : formatted}</span>
      <span className="text-xs text-muted-foreground">{tr("Cumulato nel periodo")}</span>
      {annual !== null ? <span className="text-xs tabular-nums text-muted-foreground">{formatSignedPct(annual)}{" "}{tr("annualizzato")}</span> : null}
      {description ? <span className="text-xs text-muted-foreground">{tr(description)}</span> : null}
      {note ? <span className="text-xs text-muted-foreground">{note}</span> : null}
    </PopoverTrigger>
    <PopoverContent align="start" className="max-w-80 text-sm leading-relaxed">
      <p className="font-medium">{tr(label)} · {formatted}</p>
      {periodLabel ? <p className="text-xs text-muted-foreground">{periodLabel}</p> : null}
      <div>{tr(hint)}</div>
      {value !== null ? <p className="text-xs text-muted-foreground">{tr("La percentuale principale è il rendimento complessivo di questo intervallo. Il valore annualizzato, quando presente, è il tasso annuo equivalente.")}</p> : null}
    </PopoverContent>
  </Popover>;
}
