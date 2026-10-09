"use client";

/**
 * Prossime scadenze nella sidebar: rate dei finanziamenti e collegamenti bancari da rinnovare, dalla più vicina.
 * Ogni riga porta alla sezione giusta; una scadenza passata è in rosso. Non mostra nulla senza scadenze o con la
 * sidebar compressa.
 */

import Link from "next/link";
import { CollapsibleSection } from "@/components/domain/shared";
import type { SidebarDeadlines } from "@/lib/sidebar/types";
import { cn } from "@/lib/utils";
import { formatDeadlineDay, formatSidebarAmount } from "./sidebar-insights.utils";

export interface SidebarDeadlinesProps {
  data: SidebarDeadlines | undefined;
  loading: boolean;
  hidden: boolean;
  collapsed: boolean;
  /** Chiamata quando si segue un link (chiude il drawer mobile). */
  onNavigate?: () => void;
  /** Chiamata al clic su una scadenza (per le statistiche d'uso). */
  onItemClick?: () => void;
}

export function SidebarDeadlinesModule({ data, loading, hidden, collapsed, onNavigate, onItemClick }: SidebarDeadlinesProps) {
  if (collapsed) return null;
  if (loading) {
    return <div className="mt-1 h-14 animate-pulse rounded-lg bg-sidebar-accent" aria-busy="true" />;
  }
  if (!data || data.items.length === 0) return null;
  const overdue = data.items.filter((i) => i.overdue).length;
  return (
    <CollapsibleSection
      id="scadenze"
      title="Prossime scadenze"
      summary={data.items[0] ? formatDeadlineSummary(data.items[0].date) : undefined}
      badge={
        overdue > 0 ? (
          <span className="rounded-full bg-neg-soft px-1.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-neg">
            {overdue} {overdue === 1 ? "scaduta" : "scadute"}
          </span>
        ) : undefined
      }
    >
      <ul className="flex flex-col">
        {data.items.map((item) => {
          const { day, month } = formatDeadlineDay(item.date);
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                onClick={() => {
                  onItemClick?.();
                  onNavigate?.();
                }}
                className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-sidebar-accent focus-visible:bg-sidebar-accent focus-visible:outline-none"
              >
                <span
                  className={cn(
                    "flex w-9 shrink-0 flex-col items-center rounded-md py-0.5 leading-tight",
                    item.overdue ? "bg-neg-soft text-neg" : "bg-sidebar-accent text-sidebar-foreground"
                  )}
                >
                  <span className="text-[9px] font-semibold uppercase tracking-wide opacity-70">{month}</span>
                  <span className="font-heading text-sm font-semibold tabular-nums">{day}</span>
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-sidebar-foreground">{item.label}</span>
                {item.amount !== null ? (
                  <span className="shrink-0 font-heading text-[13px] font-semibold tabular-nums text-sidebar-foreground">
                    {formatSidebarAmount(item.amount, data.currency, hidden)}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </CollapsibleSection>
  );
}

/** Riepilogo a sezione chiusa: la data della prossima scadenza ("12 ott"). */
function formatDeadlineSummary(date: string): string {
  const { day, month } = formatDeadlineDay(date);
  return `${day} ${month}`;
}
