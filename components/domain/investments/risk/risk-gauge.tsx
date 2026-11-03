"use client";

/**
 * Risk level as a half dial (180°): four arcs from green to red, the portfolio's arc full and the others faded, a needle
 * where the yearly swing falls, and in the middle the level word in its colour with the swing under it. Colour is never
 * the only signal: the word and an `aria-label` say the level too.
 */

import { localizedRiskInsights, type RiskLevel } from "@/lib/investments/risk-insights";
import { useLocalization } from "@/lib/localization/provider";
import { cn } from "@/lib/utils";

const LEVELS: RiskLevel[] = [1, 2, 3, 4];
const LEVEL_TEXT: Record<RiskLevel, string> = { 1: "text-risk-1", 2: "text-risk-2", 3: "text-risk-3", 4: "text-risk-4" };
const LEVEL_STROKE: Record<RiskLevel, string> = { 1: "var(--risk-1)", 2: "var(--risk-2)", 3: "var(--risk-3)", 4: "var(--risk-4)" };

/** Geometry of the dial in SVG units: centre, radius, stroke and the gap between arcs (degrees). */
const CX = 100;
const CY = 100;
const RADIUS = 80;
const STROKE = 16;
const GAP_DEGREES = 3;

/** Point on the dial for a fraction of the half circle (0 = left end, 1 = right end). */
function point(fraction: number, radius = RADIUS): [number, number] {
  const angle = Math.PI * (1 - fraction);
  return [CX + radius * Math.cos(angle), CY - radius * Math.sin(angle)];
}

function arc(from: number, to: number): string {
  const [x1, y1] = point(from);
  const [x2, y2] = point(to);
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${RADIUS} ${RADIUS} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

export interface RiskGaugeProps {
  level: RiskLevel;
  /** Where the needle points, 0–1 along the four bands (`riskScalePosition`). */
  position: number;
  /** Swing already formatted, e.g. «±5,5% all'anno». */
  caption: string;
  className?: string;
}

export function RiskGauge({ level, position, caption, className }: RiskGaugeProps) {
  const { t: tr, language } = useLocalization();
  const { RISK_LEVEL_LABELS } = localizedRiskInsights(language);
  const label = tr(RISK_LEVEL_LABELS[level]);
  const gap = GAP_DEGREES / 180;
  const [nx, ny] = point(position, RADIUS - STROKE / 2 - 10);
  return (
    <div role="img" aria-label={tr("Livello di rischio {0}, {1} su 4", { 0: label, 1: level })} className={cn("relative mx-auto w-full max-w-64", className)}>
      <svg viewBox="0 0 200 112" className="w-full overflow-visible" aria-hidden="true">
        {LEVELS.map((step) => (
          <path
            key={step}
            d={arc((step - 1) / 4 + (step === 1 ? 0 : gap / 2), step / 4 - (step === 4 ? 0 : gap / 2))}
            fill="none"
            stroke={LEVEL_STROKE[step]}
            strokeWidth={STROKE}
            strokeLinecap="butt"
            opacity={step === level ? 1 : 0.22}
          />
        ))}
        <line x1={CX} y1={CY} x2={nx} y2={ny} stroke="var(--foreground)" strokeWidth={3.5} strokeLinecap="round" />
        <circle cx={CX} cy={CY} r={6} fill="var(--foreground)" />
      </svg>
      <div className="mt-1 flex flex-col items-center text-center">
        <span className={cn("font-display text-4xl leading-none", LEVEL_TEXT[level])}>{label}</span>
        <span className="mt-1 text-sm tabular-nums text-muted-foreground">{caption}</span>
      </div>
    </div>
  );
}
