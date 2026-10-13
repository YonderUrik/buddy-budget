"use client";
import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";

/**
 * Card "Rendimento nel tempo": heatmap dei rendimenti del portafoglio per giorno, settimana, mese o anno, con
 * legenda e il dettaglio della casella sotto il puntatore. Riceve i rendimenti giornalieri già calcolati.
 */

import * as React from "react";
import { SegmentedControl } from "@/components/domain/shared";
import { CalendarRangeIcon } from "lucide-react";
import { PanelSection } from "./panel-section";
import { HEATMAP_LEVELS, type HeatmapCell, type HeatmapGrouping } from "@/lib/calc/return-heatmap";
import type { DailyReturn } from "@/lib/calc/returns";
import { heatmapFromDaily } from "@/lib/investments/return-heatmap-view";

import { heatmapCellColor, ReturnHeatmapGrid } from "./return-heatmap-grid";

const GROUPING_OPTIONS = [
  { value: "giorno", label: "Giorni" },
  { value: "settimana", label: "Settimane" },
  { value: "mese", label: "Mesi" },
  { value: "anno", label: "Anni" },
] as const satisfies readonly { value: HeatmapGrouping; label: string }[];

/** Nome dei gruppi al plurale, per la frase di riepilogo. */
const GROUPING_NOUN: Record<HeatmapGrouping, [string, string]> = {
  giorno: ["giorno", "giorni"],
  settimana: ["settimana", "settimane"],
  mese: ["mese", "mesi"],
  anno: ["anno", "anni"],
};

const DEFAULT_GROUPING: HeatmapGrouping = "mese";

function legendCell(ret: number, level: number): HeatmapCell {
  return { key: `legend-${ret}-${level}`, label: "", ret, gain: null, level };
}

export interface ReturnHeatmapCardProps {
  daily: DailyReturn[];
  currency: string;
  today: Date;
  periodLabel?: string;
}

export function ReturnHeatmapCard({ daily, currency, today, periodLabel }: ReturnHeatmapCardProps) {
  const { locale: formattingLocale } = useLocalization();
  const { formatSignedCurrency, formatSignedPct } = localizedFormats(formattingLocale);

  const { t: tr } = useLocalization();
  const [grouping, setGrouping] = React.useState<HeatmapGrouping>(DEFAULT_GROUPING);
  const [inspected, setInspected] = React.useState<HeatmapCell | null>(null);
  const heatmap = React.useMemo(() => heatmapFromDaily(daily, grouping, today), [daily, grouping, today]);

  function changeGrouping(next: HeatmapGrouping) {
    setGrouping(next);
    setInspected(null);
  }

  if (!heatmap) return null;
  const [singular, plural] = GROUPING_NOUN[grouping];
  const summary =
    heatmap.counted === 0
      ? `Ancora nessun ${singular} con un rendimento.`
      : `${heatmap.positive} ${heatmap.positive === 1 ? singular : plural} in guadagno e ${heatmap.negative} in perdita${
          heatmap.counted > heatmap.positive + heatmap.negative ? `, ${heatmap.counted - heatmap.positive - heatmap.negative} praticamente fermi` : ""
        }.`;

  return (
    <PanelSection
      icon={CalendarRangeIcon}
      title={tr("Rendimento TWR nel tempo")}
      color="var(--swatch-teal)"
      description={<>{periodLabel ? tr("{0}. Mesi e anni ai bordi possono essere parziali. ", {0: periodLabel}) : ""}{summary}</>}
      action={<SegmentedControl options={GROUPING_OPTIONS} value={grouping} onChange={changeGrouping} ariaLabel={tr("Raggruppa i rendimenti per")} />}
    >
      <div className="flex flex-col gap-3">
        <ReturnHeatmapGrid heatmap={heatmap} onInspect={setInspected} selectedKey={inspected?.key ?? null} />
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <p aria-live="polite" className="min-h-4 tabular-nums">
            {inspected ? (
              <>
                <span className="text-foreground">{tr(inspected.label)}</span>
                {inspected.ret === null ? (
                  " · niente investito"
                ) : (
                  <>
                    {" · "}
                    <span className={inspected.ret < 0 ? "text-neg" : "text-pos"}>{formatSignedPct(inspected.ret)}</span>
                    {inspected.gain !== null ? ` · ${formatSignedCurrency(inspected.gain, currency)}` : null}
                  </>
                )}
              </>
            ) : (
              "Passa sopra o tocca una casella per il dettaglio."
            )}
          </p>
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span>{tr("Perdita")}</span>
            {Array.from({ length: HEATMAP_LEVELS }, (_, i) => HEATMAP_LEVELS - i).map((level) => (
              <span key={`n${level}`} className="size-3 rounded-[3px]" style={{ backgroundColor: heatmapCellColor(legendCell(-1, level)) }} />
            ))}
            <span className="size-3 rounded-[3px] bg-muted" />
            {Array.from({ length: HEATMAP_LEVELS }, (_, i) => i + 1).map((level) => (
              <span key={`p${level}`} className="size-3 rounded-[3px]" style={{ backgroundColor: heatmapCellColor(legendCell(1, level)) }} />
            ))}
            <span>{tr("Guadagno")}</span>
          </div>
        </div>
      </div>
    </PanelSection>
  );
}
