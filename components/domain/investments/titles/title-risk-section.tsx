"use client";
import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";
/**
 * «Rischio» section of the security page: the same half dial as the Performance card, from the security's own
 * volatility over the last year, plus its biggest fall.
 */

import { ShieldAlertIcon } from "lucide-react";
import { localizedRiskInsights } from "@/lib/investments/risk-insights";
import type { TitleStats } from "@/lib/investments/title-stats";
import { cn } from "@/lib/utils";

import { PanelSection } from "../panel-section";

import { RiskGauge } from "../risk/risk-gauge";

export interface TitleRiskSectionProps {
  stats: TitleStats;
}

export function TitleRiskSection({ stats }: TitleRiskSectionProps) {
  const { riskLevel, riskLevelInsight, riskScalePosition } = localizedRiskInsights(useLocalization().language);

  const { locale: formattingLocale } = useLocalization();
  const { formatSignedPct, formatPct } = localizedFormats(formattingLocale);

  const { t: tr } = useLocalization();
  if (stats.volatility === null) return null;
  const level = riskLevel(stats.volatility);
  return (
    <PanelSection icon={ShieldAlertIcon} title={tr("Rischio")} color="var(--swatch-orange)" description={tr("Nell'ultimo anno")}>
      <div className="flex flex-col gap-3">
        <RiskGauge level={level} position={riskScalePosition(stats.volatility)} caption={tr("Oscilla di ±{0} in un anno", { 0: formatPct(stats.volatility) })} />
        <p className="text-center text-sm text-muted-foreground">{riskLevelInsight(level)}</p>
      </div>
      {stats.maxDrawdown !== null ? (
        <p className="text-sm text-muted-foreground">{tr("Calo più forte nell'ultimo anno:")}{" "}
          <span className={cn("font-medium tabular-nums", stats.maxDrawdown < -0.005 ? "text-neg" : "text-foreground")}>
            {stats.maxDrawdown < -0.005 ? formatSignedPct(stats.maxDrawdown) : tr("nessuno")}
          </span>
          {"."}</p>
      ) : null}
    </PanelSection>
  );
}
