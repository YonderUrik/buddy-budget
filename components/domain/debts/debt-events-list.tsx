"use client";

/** Registro degli eventi di un finanziamento (pagamenti, cambi di tasso, correzioni), con eliminazione. */

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DebtEventView } from "@/lib/debts/view";
import { formatCurrency, formatDateWithYear } from "@/lib/format";

export interface DebtEventsListProps {
  events: DebtEventView[];
  currency: string;
  onDelete: (eventId: string) => void;
}

export function describeEvent(event: DebtEventView, currency: string): string {
  if (event.type === "payment") return `Rata ${event.installmentNumber} pagata · ${formatCurrency(event.amount ?? 0, currency)}`;
  if (event.type === "rate_change") return `Tasso portato al ${String(event.rate).replace(".", ",")}%`;
  if (event.type === "early_repayment") {
    const how = event.effect === "reduce_installment" ? "rata ridotta" : "durata ridotta";
    const penalty = event.penalty ? ` · penale ${formatCurrency(event.penalty, currency)}` : "";
    return `Estinzione anticipata di ${formatCurrency(event.amount ?? 0, currency)} · ${how}${penalty}`;
  }
  return `Residuo corretto a ${formatCurrency(event.amount ?? 0, currency)}`;
}

export function DebtEventsList({ events, currency, onDelete }: DebtEventsListProps) {
  if (events.length === 0) return <p className="text-sm text-muted-foreground">Ancora nessun evento: segna una rata pagata o registra un cambio.</p>;
  const ordered = [...events].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <ul className="divide-y">
      {ordered.map((event) => (
        <li key={event.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="truncate text-sm text-foreground">{describeEvent(event, currency)}</p>
            <p className="text-xs text-muted-foreground">{formatDateWithYear(event.date)}</p>
          </div>
          <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" aria-label="Elimina evento" onClick={() => onDelete(event.id)}>
            <Trash2 size={15} aria-hidden="true" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
