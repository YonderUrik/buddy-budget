"use client";

/** Tessera "Investimenti": guadagno o perdita di mercato sul versato e quante posizioni. Presentazionale. */

import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface InvestmentsPulseCardProps {
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

export function InvestmentsPulseCard({ value, paid, marketGain, positions, currency, href = "/investimenti", onLinkClick, className }: InvestmentsPulseCardProps) {
  const format = (n: number) => formatCurrency(n, currency, { maximumFractionDigits: 0 });
  const ratio = paid > 0 ? marketGain / paid : null;
  const sign = marketGain < 0 ? "−" : "+";
  return (
    <Card className={cn("gap-2 p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Investimenti</h2>
        <Link href={href} onClick={onLinkClick} className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
          Portafoglio
          <ArrowRightIcon className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
      <p className={cn("font-heading text-2xl font-medium tabular-nums", marketGain < 0 ? "text-neg" : "text-pos")}>
        {sign}
        {format(Math.abs(marketGain))}
      </p>
      <p className="text-xs text-muted-foreground">
        {ratio !== null ? `${sign}${Math.abs(ratio * 100).toFixed(1).replace(".", ",")}% sul versato` : "Rendimento sul versato non disponibile"}
      </p>
      <div className="flex items-center justify-between border-t pt-3 text-sm">
        <span className="text-muted-foreground">{positions === 1 ? "1 posizione" : `${positions} posizioni`}</span>
        <span className="font-heading font-medium tabular-nums">{format(value)}</span>
      </div>
    </Card>
  );
}
