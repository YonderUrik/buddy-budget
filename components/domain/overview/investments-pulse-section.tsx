"use client";
import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";

/** Sezione "Investimenti": quanto vale il portafoglio e come si divide tra versato e guadagno di mercato. Senza riquadro. */

import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { SectionHeading } from "./section-heading";

export interface InvestmentsPulseSectionProps {
  value: number;
  /** Capitale versato (costo). */
  paid: number;
  /** Guadagno o perdita di mercato (valore − versato). */
  marketGain: number;
  positions: number;
  currency: string;
  href?: string;
  onLinkClick?: () => void;
  className?: string;
}

export function InvestmentsPulseSection({ value, paid, marketGain, positions, currency, href = "/investimenti", onLinkClick, className }: InvestmentsPulseSectionProps) {
  const { locale: formattingLocale } = useLocalization();
  const { formatCurrency } = localizedFormats(formattingLocale);

  const { t: tr } = useLocalization();
  const format = (n: number) => formatCurrency(n, currency, { maximumFractionDigits: 0 });
  const ratio = paid > 0 ? marketGain / paid : null;
  const isLoss = marketGain < 0;
  const Trend = isLoss ? TrendingDownIcon : TrendingUpIcon;
  const sign = isLoss ? "−" : "+";
  // La barra mostra da cosa è fatto il valore: versato più (o meno) il mercato, mai oltre il 100%.
  const paidShare = value > 0 ? Math.min(1, Math.max(0, Math.min(paid, value) / value)) : 0;
  return (
    <section aria-labelledby="overview-investments" className={cn("flex flex-col gap-3", className)}>
      <SectionHeading id="overview-investments" icon={Trend} title={tr("Investimenti")} color="var(--primary)" href={href} linkLabel={tr("Portafoglio")} onLinkClick={onLinkClick} />
      <p className={cn("flex items-baseline gap-2 font-heading text-3xl font-medium tabular-nums", isLoss ? "text-neg" : "text-pos")}>
        {sign}
        {format(Math.abs(marketGain))}
        <span className="font-sans text-sm font-normal text-muted-foreground">
          {ratio !== null ? tr("{0}{1}% sul versato", {0: sign, 1: new Intl.NumberFormat(formattingLocale, { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false }).format(Math.abs(ratio * 100))}) : tr("dal mercato")}
        </span>
      </p>
      <div className="flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={tr("Portafoglio da {0}: {1} versati e {2} {3} dal mercato", {0: format(value), 1: format(Math.min(paid, value)), 2: format(Math.abs(marketGain)), 3: isLoss ? "persi" : "guadagnati"})}>
        <div className="h-full bg-primary" style={{ width: `${paidShare * 100}%` }} />
        {!isLoss ? <div className="h-full bg-pos" style={{ width: `${(1 - paidShare) * 100}%` }} /> : null}
      </div>
      <p className="flex justify-between text-sm text-muted-foreground">
        <span>{positions === 1 ? tr("1 posizione") : tr("{0} posizioni", {0: positions})}{" "}{tr("· versati")}{" "}{format(paid)}</span>
        <span className="font-medium text-foreground">{format(value)}</span>
      </p>
    </section>
  );
}
