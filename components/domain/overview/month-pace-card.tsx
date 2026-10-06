"use client";

/** Tessera "Questo mese": spese fino a oggi contro il solito, budget residuo ed entrate. Presentazionale. */

import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { MonthPace } from "@/lib/calc/month-pace";
import { cn } from "@/lib/utils";

/** Oltre questa quota di differenza dal solito la frase smette di dire "in linea". */
const PACE_TOLERANCE = 0.05;

export interface MonthPaceCardProps {
  pace: MonthPace;
  /** Nome del mese già formattato ("ottobre"). */
  monthLabel: string;
  currency: string;
  href?: string;
  onLinkClick?: () => void;
  className?: string;
}

function paceSentence(spent: number, typical: number | null, format: (n: number) => string): { text: string; tone: "pos" | "warn" | "neutral" } {
  if (typical === null) return { text: "Non c'è ancora uno storico per il confronto.", tone: "neutral" };
  const diff = spent - typical;
  if (Math.abs(diff) <= Math.max(typical * PACE_TOLERANCE, 1)) return { text: `In linea con il solito (${format(typical)}).`, tone: "neutral" };
  if (diff > 0) return { text: `${format(diff)} più del solito a questo punto (${format(typical)}).`, tone: "warn" };
  return { text: `${format(-diff)} meno del solito a questo punto (${format(typical)}).`, tone: "pos" };
}

export function MonthPaceCard({ pace, monthLabel, currency, href = "/movimenti/analisi", onLinkClick, className }: MonthPaceCardProps) {
  const format = (value: number) => formatCurrency(value, currency, { maximumFractionDigits: 0 });
  const sentence = paceSentence(pace.spentSoFar, pace.typicalSoFar, format);
  const budgetUsed = pace.budgetTotal && pace.budgetTotal > 0 ? Math.min(1, pace.budgetSpent / pace.budgetTotal) : null;
  const overBudget = pace.budgetTotal !== null && pace.budgetSpent > pace.budgetTotal;

  return (
    <Card className={cn("gap-3 p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {monthLabel} · giorno {pace.dayOfMonth} di {pace.daysInMonth}
        </h2>
        <Link href={href} onClick={onLinkClick} className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
          Movimenti
          <ArrowRightIcon className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
      <p className="font-heading text-2xl font-medium tabular-nums text-foreground">
        {format(pace.spentSoFar)} <span className="font-sans text-sm font-normal text-muted-foreground">spesi finora</span>
      </p>
      <p className={cn("text-xs", sentence.tone === "warn" ? "text-neg" : sentence.tone === "pos" ? "text-pos" : "text-muted-foreground")}>{sentence.text}</p>
      {budgetUsed !== null && pace.budgetTotal !== null ? (
        <div className="flex flex-col gap-1.5">
          <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(budgetUsed * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Budget del mese usato">
            <div className={cn("h-full rounded-full", overBudget ? "bg-neg" : "bg-primary")} style={{ width: `${budgetUsed * 100}%` }} />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{Math.round(budgetUsed * 100)}% del budget</span>
            <span>{overBudget ? `sforato di ${format(pace.budgetSpent - pace.budgetTotal)}` : `restano ${format(pace.budgetTotal - pace.budgetSpent)} di ${format(pace.budgetTotal)}`}</span>
          </div>
        </div>
      ) : null}
      <div className="flex items-center justify-between border-t pt-3 text-sm">
        <span className="text-muted-foreground">Entrate ricevute</span>
        <span className="font-heading font-medium tabular-nums text-pos">{format(pace.income)}</span>
      </div>
    </Card>
  );
}
