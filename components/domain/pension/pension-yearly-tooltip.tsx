"use client";
import { useLocalization } from "@/lib/localization/provider";

/** Tooltip del grafico anno per anno: versato, rendimento in valore e in percentuale, con la definizione della percentuale. */

import { localizedPensionFormats } from "./pension-format";
import { PensionTooltipFrame, PensionTooltipRow } from "./pension-chart-tooltip";

export interface PensionYearlyPoint {
  label: string;
  contributions: number;
  gain: number;
  returnRate: number | null;
  partial: boolean;
}

export interface PensionYearlyTooltipProps {
  /** Iniettate da Recharts. */
  active?: boolean;
  payload?: readonly { payload?: PensionYearlyPoint }[];
  currency: string;
}

const RETURN_DEFINITION = "Rendimento ÷ (valore a inizio anno + versamenti dell'anno)";

/** Tooltip a tre righe (versato, rendimento, rendimento %) per una barra dell'anno. */
export function PensionYearlyTooltip({ active, payload, currency }: PensionYearlyTooltipProps) {
  const { formatSignedPercent, money } = localizedPensionFormats(useLocalization().language);

  const { t: tr } = useLocalization();
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  const isLoss = point.gain < 0;
  const gainColor = isLoss ? "var(--neg)" : "var(--pos)";
  const gainClass = isLoss ? "text-neg" : "text-pos";
  return (
    <PensionTooltipFrame title={point.partial ? tr("{0} (anno in corso)", {0: point.label.replace("*", "")}) : point.label}>
      <PensionTooltipRow color="var(--primary)" label={tr("Versato")} value={money(point.contributions, currency)} />
      <PensionTooltipRow color={gainColor} label={isLoss ? tr("Perdita") : tr("Rendimento")} value={`${isLoss ? "−" : "+"}${money(Math.abs(point.gain), currency)}`} valueClassName={gainClass} />
      <PensionTooltipRow color={gainColor} label={tr("Rendimento %")} value={point.returnRate !== null ? formatSignedPercent(point.returnRate) : "n.d."} valueClassName={point.returnRate !== null ? gainClass : undefined} />
      <p className="text-[11px] leading-snug text-muted-foreground">{tr(RETURN_DEFINITION)}{point.partial ? tr(", non annualizzato") : ""}</p>
    </PensionTooltipFrame>
  );
}
