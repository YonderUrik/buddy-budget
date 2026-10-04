/** Livello di rischio in sintesi: titolo, scala a 4 tacche (mai solo colore: c'è sempre la parola) e una frase. */

import { RISK_LEVEL_LABELS, riskLevelInsight, type RiskLevel } from "@/lib/investments/risk-insights";
import { cn } from "@/lib/utils";

const LEVELS: RiskLevel[] = [1, 2, 3, 4];

export interface RiskLevelMeterProps {
  level: RiskLevel;
}

export function RiskLevelMeter({ level }: RiskLevelMeterProps) {
  const label = RISK_LEVEL_LABELS[level];
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-baseline gap-2">
        <span className="text-sm text-muted-foreground">Rischio</span>
        <span className="font-heading text-2xl font-medium text-foreground">{label}</span>
      </p>
      <div role="img" aria-label={`Livello di rischio ${label}, ${level} su 4`} className="flex max-w-xs gap-1.5">
        {LEVELS.map((step) => (
          <span key={step} className={cn("h-2 flex-1 rounded-full", step <= level ? "bg-foreground" : "bg-muted")} />
        ))}
      </div>
      <p className="max-w-prose text-sm text-muted-foreground">{riskLevelInsight(level)}</p>
    </div>
  );
}
