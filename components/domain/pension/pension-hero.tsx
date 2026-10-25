"use client";
import { useLocalization } from "@/lib/localization/provider";
/**
 * Cifra eroe di Pensione: controvalore del fondo con importo grande, guadagno sul versato, grafico a tutta larghezza e le
 * misure (versato, guadagno in percentuale, rendimento annuo ponderato per i tempi) in riga, senza riquadri.
 */

import type { ReactNode } from "react";
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { MoneyHero } from "@/components/domain/net-worth";
import { InfoHint, PAGE_BLEED } from "@/components/domain/shared";
import type { PensionPerformance, PensionSnapshot } from "@/lib/calc/pension";
import { cn } from "@/lib/utils";
import { localizedPensionFormats } from "./pension-format";
import { PensionTrendChart } from "./pension-trend-chart";

export interface PensionHeroProps {
  name: string;
  performance: PensionPerformance;
  snapshots: PensionSnapshot[];
  currency: string;
  className?: string;
}

const ANNUAL_RETURN_HINT =
  "Rendimento annuo che tiene conto di quando hai versato: un euro versato il mese scorso non ha avuto il tempo di rendere. Se manca lo storico dei primi anni è una stima.";

function Measure({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: ReactNode }) {
  const { t: tr } = useLocalization();
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-sm text-text-2">
        {tr(label)}
        {tr(hint)}
      </dt>
      <dd className="font-heading text-xl font-medium tabular-nums text-foreground">{children}</dd>
    </div>
  );
}

export function PensionHero({ name, performance, snapshots, currency, className }: PensionHeroProps) {
  const { formatLongDateKey, formatSignedPercent, money } = localizedPensionFormats(useLocalization().language);

  const { t: tr } = useLocalization();
  const { value, netContributions, gain, gainPct, annualReturn, approximate, lastDate } = performance;
  const up = gain >= 0;
  const Icon = up ? TrendingUpIcon : TrendingDownIcon;
  const tone = up ? "text-pos" : "text-neg";
  const sign = up ? "+" : "−";
  return (
    <section aria-label={name} data-page-block="hero" className={className}>
      <p className="text-base text-text-2">
        {name}{" "}<span aria-hidden="true">{"·"}</span>{" "}{tr("aggiornato al")}{" "}{formatLongDateKey(lastDate)}
      </p>
      <MoneyHero value={value} currency={currency} className="text-5xl leading-none tracking-tight sm:text-7xl" />
      <p className="mt-3 flex flex-wrap items-center gap-x-2 text-sm">
        <span className={cn("inline-flex items-center gap-1.5 font-semibold tabular-nums", tone)}>
          <Icon className="size-4" aria-hidden="true" />
          {sign}
          {money(Math.abs(gain), currency)}
        </span>
        <span className="text-text-2">{up ? tr("di guadagno") : tr("di perdita")}{" "}{tr("sui contributi versati")}</span>
      </p>
      <div className={cn(PAGE_BLEED, "mt-2")}>
        <PensionTrendChart snapshots={snapshots} currency={currency} />
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
        <Measure label={tr("Versato")}>{money(netContributions, currency)}</Measure>
        <Measure label={tr("Sui contributi")}>
          <span className={tone}>{gainPct !== null ? formatSignedPercent(gainPct) : "—"}</span>
        </Measure>
        <Measure label={<>{tr("Rendimento annuo")}{approximate ? tr(" (stima)") : ""}</>} hint={<InfoHint label={tr("Come si calcola il rendimento annuo")}>{tr(ANNUAL_RETURN_HINT)}</InfoHint>}>
          {annualReturn !== null ? formatSignedPercent(annualReturn) : "—"}
        </Measure>
      </dl>
    </section>
  );
}
