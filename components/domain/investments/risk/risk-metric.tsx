/** Un indicatore di rischio: etichetta con spiegazione, valore in evidenza (neutro, non verde/rosso) e una nota. */

import type { ReactNode } from "react";
import { InfoHint } from "@/components/domain/shared";

export interface RiskMetricProps {
  label: string;
  /** Spiegazione nel popover "i". */
  hint: ReactNode;
  /** Valore già formattato; null mostra un trattino. */
  value: string | null;
  /** Riga sotto il valore (es. perché manca). */
  note?: string | null;
}

export function RiskMetric({ label, hint, value, note = null }: RiskMetricProps) {
  return (
    <div className="flex flex-col gap-1">
      <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        {label}
        <InfoHint label={`Cos'è: ${label}`}>{hint}</InfoHint>
      </p>
      <p className="font-heading text-2xl font-medium tabular-nums text-foreground">{value ?? "—"}</p>
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}
