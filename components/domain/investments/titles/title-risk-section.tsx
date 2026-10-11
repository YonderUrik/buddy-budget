/**
 * Sezione «Quanto rischia» della pagina titolo: stesso livello di rischio (scala a 4 fasce) della scheda del
 * Portafoglio, calcolato sulla volatilità dell'ultimo anno del solo titolo, più la caduta massima.
 */

import { ShieldAlertIcon } from "lucide-react";
import { riskLevel } from "@/lib/investments/risk-insights";
import type { TitleStats } from "@/lib/investments/title-stats";
import { cn } from "@/lib/utils";
import { formatSignedPct } from "../gain-text";
import { PanelSection } from "../panel-section";
import { formatPct } from "../percent";
import { RiskLevelMeter } from "../risk/risk-level-meter";

export interface TitleRiskSectionProps {
  stats: TitleStats;
}

export function TitleRiskSection({ stats }: TitleRiskSectionProps) {
  if (stats.volatility === null) return null;
  const level = riskLevel(stats.volatility);
  return (
    <PanelSection icon={ShieldAlertIcon} title="Quanto rischia" color="var(--swatch-orange)" description="Nell'ultimo anno">
      <RiskLevelMeter
        level={level}
        volatility={stats.volatility}
        volatilityText={`±${formatPct(stats.volatility)}`}
        volatilityHint="Volatilità annua: di norma il prezzo si muove di circa questa percentuale in un anno, in su o in giù (due anni su tre)."
      />
      {stats.maxDrawdown !== null ? (
        <p className="text-sm text-muted-foreground">
          Calo peggiore dal massimo nell&apos;ultimo anno:{" "}
          <span className={cn("font-medium tabular-nums", stats.maxDrawdown < -0.005 ? "text-neg" : "text-foreground")}>
            {stats.maxDrawdown < -0.005 ? formatSignedPct(stats.maxDrawdown) : "nessuno"}
          </span>
          .
        </p>
      ) : null}
    </PanelSection>
  );
}
