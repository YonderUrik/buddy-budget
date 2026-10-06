"use client";

/** Tessera "Prossime scadenze": le prossime rate dei finanziamenti, con importo e data. Presentazionale. */

import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Quante rate mostrare nella tessera. */
export const UPCOMING_DUES_LIMIT = 3;

export interface UpcomingDue {
  debtId: string;
  name: string;
  /** Data della rata, "YYYY-MM-DD". */
  date: string;
  amount: number;
  overdue: boolean;
}

export interface UpcomingDuesCardProps {
  dues: UpcomingDue[];
  currency: string;
  href?: string;
  onLinkClick?: () => void;
  /** Frase sotto l'elenco (es. quanto è sceso il residuo). */
  footnote?: string;
  className?: string;
}

export function UpcomingDuesCard({ dues, currency, href = "/debiti", onLinkClick, footnote, className }: UpcomingDuesCardProps) {
  if (dues.length === 0) return null;
  const format = (value: number) => formatCurrency(value, currency, { maximumFractionDigits: 0 });
  return (
    <Card className={cn("gap-1 p-5", className)}>
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prossime scadenze</h2>
        <Link href={href} onClick={onLinkClick} className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
          Debiti
          <ArrowRightIcon className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
      <ul>
        {dues.slice(0, UPCOMING_DUES_LIMIT).map((due) => (
          <li key={`${due.debtId}-${due.date}`} className="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-b-0">
            <span className="min-w-0 truncate">
              <span className={cn("font-semibold", due.overdue && "text-neg")}>{formatShortDate(due.date)}</span>
              <span className="text-muted-foreground"> · {due.name}</span>
              {due.overdue ? <span className="text-neg"> · scaduta</span> : null}
            </span>
            <span className="shrink-0 font-heading font-medium tabular-nums">{format(due.amount)}</span>
          </li>
        ))}
      </ul>
      {footnote ? <p className="mt-1 text-xs text-muted-foreground">{footnote}</p> : null}
    </Card>
  );
}
