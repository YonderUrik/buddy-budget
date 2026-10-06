"use client";

/** Sezione "Questo mese": curva della spesa contro il solito, budget residuo ed entrate. Aperta sulla pagina, senza riquadro. */

import { WalletIcon } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { MonthPace } from "@/lib/calc/month-pace";
import { cn } from "@/lib/utils";
import { MonthPaceChart } from "./month-pace-chart";
import { SectionHeading } from "./section-heading";

export interface MonthPaceSectionProps {
  pace: MonthPace;
  /** Nome del mese già formattato ("ottobre"). */
  monthLabel: string;
  currency: string;
  href?: string;
  onLinkClick?: () => void;
  className?: string;
}

export function MonthPaceSection({ pace, monthLabel, currency, href = "/movimenti/analisi", onLinkClick, className }: MonthPaceSectionProps) {
  const format = (value: number) => formatCurrency(value, currency, { maximumFractionDigits: 0 });
  const budgetUsed = pace.budgetTotal && pace.budgetTotal > 0 ? Math.min(1, pace.budgetSpent / pace.budgetTotal) : null;
  const overBudget = pace.budgetTotal !== null && pace.budgetSpent > pace.budgetTotal;

  return (
    <section aria-labelledby="overview-month" className={cn("flex flex-col gap-4", className)}>
      <SectionHeading id="overview-month" icon={WalletIcon} title={`Il mese di ${monthLabel}`} color="var(--swatch-teal)" href={href} linkLabel="Movimenti" onLinkClick={onLinkClick} />
      <MonthPaceChart pace={pace} currency={currency} />
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t pt-4 text-sm">
        <div>
          <dt className="text-muted-foreground">Entrate ricevute</dt>
          <dd className="font-heading text-lg font-medium tabular-nums text-pos">{format(pace.income)}</dd>
        </div>
        {budgetUsed !== null && pace.budgetTotal !== null ? (
          <div>
            <dt className="text-muted-foreground">Budget</dt>
            <dd className="font-heading text-lg font-medium tabular-nums text-foreground">
              {overBudget ? `sforato di ${format(pace.budgetSpent - pace.budgetTotal)}` : `restano ${format(pace.budgetTotal - pace.budgetSpent)}`}
            </dd>
            <div
              className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={Math.round(budgetUsed * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Budget usato: ${Math.round(budgetUsed * 100)}% di ${format(pace.budgetTotal)}`}
            >
              <div className={cn("h-full rounded-full", overBudget ? "bg-neg" : "bg-primary")} style={{ width: `${budgetUsed * 100}%` }} />
            </div>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
