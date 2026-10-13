/** Sezione «Anno per anno»: variazione di prezzo di ogni anno solare, calcolata dalle chiusure salvate. */

import { CalendarRangeIcon } from "lucide-react";
import type { AnnualReturn } from "@/lib/investments/title-fundamentals";
import { cn } from "@/lib/utils";
import { formatSignedPct } from "../gain-text";
import { PanelSection } from "../panel-section";

/** Anni mostrati al massimo (i più recenti). */
const MAX_YEARS = 6;

export interface TitleAnnualReturnsProps {
  returns: AnnualReturn[];
}

export function TitleAnnualReturns({ returns }: TitleAnnualReturnsProps) {
  if (returns.length === 0) return null;
  const shown = returns.slice(-MAX_YEARS);
  return (
    <PanelSection icon={CalendarRangeIcon} title="Anno per anno" color="var(--swatch-cyan)" description="Variazione del prezzo in ogni anno solare, senza dividendi né tasse.">
      <dl className="grid grid-cols-3 gap-x-6 gap-y-4 sm:grid-cols-6">
        {shown.map((r) => (
          <div key={r.year}>
            <dt className="text-xs text-muted-foreground">{r.partial ? `${r.year} (finora)` : r.year}</dt>
            <dd className={cn("font-heading text-lg font-medium tabular-nums", r.value < 0 ? "text-neg" : "text-pos")}>{formatSignedPct(r.value)}</dd>
          </div>
        ))}
      </dl>
    </PanelSection>
  );
}
