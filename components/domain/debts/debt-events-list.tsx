"use client";
import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";

/** Registro degli eventi di un finanziamento (pagamenti, cambi di tasso, correzioni), con eliminazione. */

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DebtEventView } from "@/lib/debts/view";

export interface DebtEventsListProps {
  events: DebtEventView[];
  currency: string;
  onDelete: (eventId: string) => void;
}

export function DebtEventsList({ events, currency, onDelete }: DebtEventsListProps) {
  const { locale: formattingLocale } = useLocalization();
  const { formatCurrency, formatDateWithYear } = localizedFormats(formattingLocale);
  function describeEvent(event: DebtEventView, currency: string): string {
  // Una rata segnata senza importo è quella del piano: niente «0,00 €».
  if (event.type === "payment")
    return tr("Rata {0} pagata{1}", { 0: event.installmentNumber, 1: event.amount ? ` · ${formatCurrency(event.amount, currency)}` : "" });
  if (event.type === "rate_change") return tr("Tasso portato al {0}%", { 0: event.rate === null ? String(event.rate) : new Intl.NumberFormat(formattingLocale, { maximumFractionDigits: 10, useGrouping: false }).format(event.rate) });
  if (event.type === "early_repayment") {
    const how = event.effect === "reduce_installment" ? tr("rata ridotta") : tr("durata ridotta");
    const penalty = event.penalty ? tr(" · penale {0}", { 0: formatCurrency(event.penalty, currency) }) : "";
    return tr("Estinzione anticipata di {0} · {1}{2}", { 0: formatCurrency(event.amount ?? 0, currency), 1: how, 2: penalty });
  }
  return tr("Residuo corretto a {0}", { 0: formatCurrency(event.amount ?? 0, currency) });
}

  const { t: tr } = useLocalization();
  if (events.length === 0) return <p className="text-sm text-muted-foreground">{tr("Ancora nessun evento: segna una rata pagata o registra un cambio.")}</p>;
  const ordered = [...events].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <ul>
      {ordered.map((event) => (
        <li key={event.id} className="flex items-center justify-between gap-3 border-b py-2.5 last:border-b-0">
          <div className="min-w-0">
            <p className="truncate text-sm text-foreground">{describeEvent(event, currency)}</p>
            <p className="text-xs text-muted-foreground">{formatDateWithYear(event.date)}</p>
          </div>
          <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" aria-label={tr("Elimina evento")} onClick={() => onDelete(event.id)}>
            <Trash2 size={15} aria-hidden="true" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
