"use client";

/** Sezione "Prossime rate": un'agenda delle scadenze dei finanziamenti, con giorno in evidenza. Senza riquadro. */

import { CalendarClockIcon } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./section-heading";

/** Quante rate mostrare. */
export const UPCOMING_DUES_LIMIT = 3;

export interface UpcomingDue {
  debtId: string;
  name: string;
  /** Data della rata, "YYYY-MM-DD". */
  date: string;
  amount: number;
  overdue: boolean;
}

export interface UpcomingDuesSectionProps {
  dues: UpcomingDue[];
  currency: string;
  href?: string;
  onLinkClick?: () => void;
  /** Frase sotto l'elenco (es. residuo e ultima rata). */
  footnote?: string;
  className?: string;
}

const DAY = new Intl.DateTimeFormat("it-IT", { day: "numeric" });
const MONTH = new Intl.DateTimeFormat("it-IT", { month: "short" });

export function UpcomingDuesSection({ dues, currency, href = "/debiti", onLinkClick, footnote, className }: UpcomingDuesSectionProps) {
  if (dues.length === 0) return null;
  const format = (value: number) => formatCurrency(value, currency, { maximumFractionDigits: 0 });
  return (
    <section aria-labelledby="overview-dues" className={cn("flex flex-col gap-3", className)}>
      <SectionHeading id="overview-dues" icon={CalendarClockIcon} title="Prossime rate" color="var(--neg)" href={href} linkLabel="Debiti" onLinkClick={onLinkClick} />
      <ul>
        {dues.slice(0, UPCOMING_DUES_LIMIT).map((due) => {
          const date = new Date(`${due.date}T00:00:00`);
          return (
            <li key={`${due.debtId}-${due.date}`} className="flex items-center gap-3 border-b py-2.5 last:border-b-0">
              <span className="flex w-11 shrink-0 flex-col items-center rounded-lg bg-muted py-1 leading-tight" aria-hidden="true">
                <span className="font-heading text-lg font-medium text-foreground">{DAY.format(date)}</span>
                <span className="text-xs uppercase text-muted-foreground">{MONTH.format(date).replace(".", "")}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{due.name}</span>
                {due.overdue ? <span className="block text-sm text-neg">Scaduta</span> : null}
                <span className="sr-only">{`, scadenza ${due.date}`}</span>
              </span>
              <span className="shrink-0 font-heading text-base font-medium tabular-nums text-foreground">{format(due.amount)}</span>
            </li>
          );
        })}
      </ul>
      {footnote ? <p className="text-sm text-muted-foreground">{footnote}</p> : null}
    </section>
  );
}
