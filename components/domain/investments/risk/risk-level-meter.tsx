"use client";
import { useLocalization } from "@/lib/localization/provider";
/**
 * Livello di rischio in sintesi: parola grande nel colore del livello, oscillazione annua e una scala a 4 fasce
 * (dal verde al rosso) con un segnaposto che dice dove cade il portafoglio. Il colore non è mai l'unico segnale:
 * ci sono la parola e il nome della fascia sotto la scala.
 */

import type { ReactNode } from "react";
import { InfoHint } from "@/components/domain/shared";
import { localizedRiskInsights, type RiskLevel } from "@/lib/investments/risk-insights";
import { cn } from "@/lib/utils";

const LEVELS: RiskLevel[] = [1, 2, 3, 4];

/** Classi dei colori per livello (token `--risk-*`), scritte per esteso perché Tailwind le trovi. */
const LEVEL_TEXT: Record<RiskLevel, string> = { 1: "text-risk-1", 2: "text-risk-2", 3: "text-risk-3", 4: "text-risk-4" };
const LEVEL_FILL: Record<RiskLevel, string> = { 1: "bg-risk-1", 2: "bg-risk-2", 3: "bg-risk-3", 4: "bg-risk-4" };

export interface RiskLevelMeterProps {
  level: RiskLevel;
  /** Oscillazione annua (0,037 = 3,7%), per posizionare il segnaposto dentro la fascia. */
  volatility: number;
  /** Oscillazione già formattata (es. "±3,7%"). */
  volatilityText: string;
  /** Frase sull'oscillazione (con il confronto con l'indice, se scelto), sotto quella del livello. */
  volatilityNote?: ReactNode;
  /** Spiegazione del nome tecnico, nel popover "i" accanto all'oscillazione. */
  volatilityHint?: ReactNode;
}

export function RiskLevelMeter({ level, volatility, volatilityText, volatilityNote = null, volatilityHint = null }: RiskLevelMeterProps) {
  const { RISK_LEVEL_LABELS, riskLevelInsight, riskScalePosition } = localizedRiskInsights(useLocalization().language);

  const { t: tr } = useLocalization();
  const label = tr(RISK_LEVEL_LABELS[level]);
  const position = riskScalePosition(volatility);
  return (
    <div className="flex flex-col gap-3">
      <p className="flex flex-wrap items-baseline gap-x-3">
        <span className={cn("font-heading text-3xl font-medium", LEVEL_TEXT[level])}>{tr(label)}</span>
        <span className="flex items-center gap-1 text-sm text-muted-foreground">
          {volatilityText}{" "}{tr("all’anno")}{volatilityHint ? <InfoHint label={tr("Cos'è: quanto oscilla")}>{volatilityHint}</InfoHint> : null}
        </span>
      </p>
      <div role="img" aria-label={tr("Livello di rischio {0}, {1} su 4", {0: label, 1: level})} className="flex flex-col gap-1.5">
        <div className="relative flex gap-1">
          {LEVELS.map((step) => (
            <span key={step} className={cn("h-2.5 flex-1 rounded-full", LEVEL_FILL[step], step === level ? "opacity-100" : "opacity-25")} />
          ))}
          <span
            style={{ left: `${position * 100}%` }}
            className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-background bg-foreground transition-[left] duration-300 motion-reduce:transition-none"
          />
        </div>
        <div className="grid grid-cols-4 gap-1 text-xs text-muted-foreground" aria-hidden>
          {LEVELS.map((step) => (
            <span key={step} className={cn("text-center", step === level && "font-medium text-foreground")}>
              {tr(RISK_LEVEL_LABELS[step])}
            </span>
          ))}
        </div>
      </div>
      <p className="max-w-prose text-sm text-muted-foreground">
        {riskLevelInsight(level)}
        {volatilityNote ? <>{" "}{volatilityNote}</> : null}
      </p>
    </div>
  );
}
