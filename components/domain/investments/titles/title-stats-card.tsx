"use client";
import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";
/**
 * Card "In numeri": variazione su 1 mese / 3 mesi / 6 mesi / 1 anno / da inizio anno, posizione dell'ultima chiusura
 * nella forbice a 52 settimane. Volatilità e caduta massima stanno in «Quanto rischia».
 */

import { TITLE_RETURN_PERIODS, type TitleReturnPeriod, type TitleStats } from "@/lib/investments/title-stats";
import { cn } from "@/lib/utils";



import { ChartNoAxesColumnIcon } from "lucide-react";
import { PanelSection } from "../panel-section";

const RETURN_LABELS: Record<TitleReturnPeriod, string> = { "1M": "1 mese", "3M": "3 mesi", "6M": "6 mesi", "1A": "1 anno", YTD: "Da inizio anno" };

export interface TitleStatsCardProps {
  stats: TitleStats;
  currency: string;
}

function RangeBar({ low, high, last, currency }: { low: number; high: number; last: number; currency: string }) {
  const { locale: formattingLocale } = useLocalization();
  const { formatPrice } = localizedFormats(formattingLocale);

  const { t: tr } = useLocalization();
  const position = high > low ? Math.min(1, Math.max(0, (last - low) / (high - low))) : 0.5;
  return (
    <div>
      <div className="relative h-1.5 rounded-full bg-muted" role="img" aria-label={tr("Ultima chiusura al {0}% della forbice tra minimo e massimo a 52 settimane", {0: Math.round(position * 100)})}>
        <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary" style={{ left: `${position * 100}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-xs tabular-nums text-muted-foreground">
        <span>{tr("Min")}{" "}{formatPrice(low, currency)}</span>
        <span>{tr("Max")}{" "}{formatPrice(high, currency)}</span>
      </div>
    </div>
  );
}

export function TitleStatsCard({ stats, currency }: TitleStatsCardProps) {
  const { locale: formattingLocale } = useLocalization();
  const { formatSignedPct, formatPct } = localizedFormats(formattingLocale);

  const { t: tr } = useLocalization();
  const returns = TITLE_RETURN_PERIODS.filter((p) => stats.returns[p] !== undefined);
  return (
    <PanelSection icon={ChartNoAxesColumnIcon} title={tr("In numeri")} color="var(--primary)">
      <div className="flex flex-col gap-5">
        {returns.length > 0 ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-5">
            {returns.map((period) => {
              const value = stats.returns[period]!;
              return (
                <div key={period}>
                  <dt className="text-xs text-muted-foreground">{tr(RETURN_LABELS[period])}</dt>
                  <dd className={cn("text-base font-medium tabular-nums", value < 0 ? "text-neg" : "text-pos")}>{formatSignedPct(value)}</dd>
                </div>
              );
            })}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">{tr("Lo storico è ancora troppo corto per calcolare le variazioni.")}</p>
        )}

        {stats.high52 !== null && stats.low52 !== null ? (
          <div>
            <p className="mb-2 text-sm text-foreground">{tr("Forbice dell'ultimo anno")}{stats.fromHigh !== null && stats.fromHigh < -0.005 ? (
                <span className="text-muted-foreground"> {"·"}{formatPct(-stats.fromHigh)}{" "}{tr("sotto il massimo")}</span>
              ) : (
                <span className="text-muted-foreground">{" "}{tr("· sui massimi")}</span>
              )}
            </p>
            <RangeBar low={stats.low52} high={stats.high52} last={stats.lastClose} currency={currency} />
          </div>
        ) : null}

      </div>
    </PanelSection>
  );
}
