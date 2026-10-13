"use client";
import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";
/** Sezione «Anno per anno»: variazione di prezzo di ogni anno solare, calcolata dalle chiusure salvate. */

import { CalendarRangeIcon } from "lucide-react";
import type { AnnualReturn } from "@/lib/investments/title-fundamentals";
import { cn } from "@/lib/utils";

import { PanelSection } from "../panel-section";

/** Anni mostrati al massimo (i più recenti). */
const MAX_YEARS = 6;

export interface TitleAnnualReturnsProps {
  returns: AnnualReturn[];
}

export function TitleAnnualReturns({ returns }: TitleAnnualReturnsProps) {
  const { locale: formattingLocale } = useLocalization();
  const { formatSignedPct } = localizedFormats(formattingLocale);

  const { t: tr } = useLocalization();
  if (returns.length === 0) return null;
  const shown = returns.slice(-MAX_YEARS);
  return (
    <PanelSection icon={CalendarRangeIcon} title={tr("Anno per anno")} color="var(--swatch-cyan)" description={tr("Variazione del prezzo in ogni anno solare, senza dividendi né tasse.")}>
      <dl className="grid grid-cols-3 gap-x-6 gap-y-4 sm:grid-cols-6">
        {shown.map((r) => (
          <div key={r.year}>
            <dt className="text-xs text-muted-foreground">{r.partial ? tr("{0} (finora)", {0: r.year}) : r.year}</dt>
            <dd className={cn("font-heading text-lg font-medium tabular-nums", r.value < 0 ? "text-neg" : "text-pos")}>{formatSignedPct(r.value)}</dd>
          </div>
        ))}
      </dl>
    </PanelSection>
  );
}
