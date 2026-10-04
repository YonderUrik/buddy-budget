/** Un indicatore di rischio: titolo in parole semplici (con il nome tecnico nel popover "i"), valore in evidenza (neutro, non verde/rosso) e la frase che lo spiega. */

import type { ReactNode } from "react";
import { InfoHint } from "@/components/domain/shared";

export interface RiskMetricProps {
  /** Titolo in italiano semplice. */
  label: string;
  /** Spiegazione nel popover "i" (qui sta il nome tecnico). */
  hint: ReactNode;
  /** Valore già formattato; null mostra un trattino. */
  value: string | null;
  /** Riga breve sotto il valore (es. unità o perché manca). */
  note?: string | null;
  /** Frase che dice cosa significa il numero. */
  description?: ReactNode;
}

export function RiskMetric({ label, hint, value, note = null, description = null }: RiskMetricProps) {
  return (
    <div className="flex flex-col gap-1">
      <p className="flex items-center gap-1 text-sm font-medium text-foreground">
        {label}
        <InfoHint label={`Cos'è: ${label}`}>{hint}</InfoHint>
      </p>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-heading text-2xl font-medium tabular-nums text-foreground">{value ?? "—"}</span>
        {note ? <span className="text-xs text-muted-foreground">{note}</span> : null}
      </p>
      {description ? <p className="text-sm leading-snug text-muted-foreground">{description}</p> : null}
    </div>
  );
}
