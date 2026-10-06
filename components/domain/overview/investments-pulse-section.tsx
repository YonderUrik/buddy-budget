"use client";

/** Sezione "Investimenti": quanto vale il portafoglio e come si divide tra versato e guadagno di mercato. Senza riquadro. */

import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { formatCurrency } from "@/lib/format";
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
  const format = (n: number) => formatCurrency(n, currency, { maximumFractionDigits: 0 });
  const ratio = paid > 0 ? marketGain / paid : null;
  const isLoss = marketGain < 0;
  const Trend = isLoss ? TrendingDownIcon : TrendingUpIcon;
  const sign = isLoss ? "−" : "+";
  // La barra mostra da cosa è fatto il valore: versato più (o meno) il mercato, mai oltre il 100%.
  const paidShare = value > 0 ? Math.min(1, Math.max(0, Math.min(paid, value) / value)) : 0;
  return (
    <section aria-labelledby="overview-investments" className={cn("flex flex-col gap-3", className)}>
      <SectionHeading id="overview-investments" icon={Trend} title="Investimenti" color="var(--primary)" href={href} linkLabel="Portafoglio" onLinkClick={onLinkClick} />
      <p className={cn("flex items-baseline gap-2 font-heading text-3xl font-medium tabular-nums", isLoss ? "text-neg" : "text-pos")}>
        {sign}
        {format(Math.abs(marketGain))}
        <span className="font-sans text-sm font-normal text-muted-foreground">
          {ratio !== null ? `${sign}${Math.abs(ratio * 100).toFixed(1).replace(".", ",")}% sul versato` : "dal mercato"}
        </span>
      </p>
      <div className="flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={`Portafoglio da ${format(value)}: ${format(Math.min(paid, value))} versati e ${format(Math.abs(marketGain))} ${isLoss ? "persi" : "guadagnati"} dal mercato`}>
        <div className="h-full bg-primary" style={{ width: `${paidShare * 100}%` }} />
        {!isLoss ? <div className="h-full bg-pos" style={{ width: `${(1 - paidShare) * 100}%` }} /> : null}
      </div>
      <p className="flex justify-between text-sm text-muted-foreground">
        <span>{positions === 1 ? "1 posizione" : `${positions} posizioni`} · versati {format(paid)}</span>
        <span className="font-medium text-foreground">{format(value)}</span>
      </p>
    </section>
  );
}
