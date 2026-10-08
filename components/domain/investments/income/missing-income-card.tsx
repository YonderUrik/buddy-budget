"use client";

/**
 * Card "Da registrare": dividendi e cedole che probabilmente hai incassato ma non hai registrato, trovati confrontando
 * gli stacchi dello strumento con le quote che avevi. "Registra" apre il form precompilato (l'importo netto vero lo
 * dice il broker), "Ignora" nasconde la proposta per sempre.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import type { Instrument } from "@/lib/db/schema/investments";
import { formatCurrency, formatDateWithYear } from "@/lib/format";
import type { MissingIncome } from "@/lib/investments/dividends";
import { CircleAlertIcon } from "lucide-react";
import { PanelSection } from "../panel-section";

/** Proposte mostrate prima di "Mostra tutte". */
export const MISSING_INCOME_LIMIT = 5;
/** Oltre questi mesi una proposta è "vecchia": si può ignorare in blocco (es. storico importato senza dividendi). */
export const OLD_MISSING_INCOME_MONTHS = 12;

function monthsAgoKey(todayKey: string, months: number): string {
  const [y, m, d] = todayKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 - months, Math.min(d, 28)));
  return date.toISOString().slice(0, 10);
}

export interface MissingIncomeCardProps {
  missing: MissingIncome[];
  instrumentsById: Map<string, Instrument>;
  currency: string;
  onRegister: (item: MissingIncome) => void;
  onDismiss: (item: MissingIncome) => void;
  /** Ignora in blocco le proposte più vecchie di `OLD_MISSING_INCOME_MONTHS` mesi. */
  onDismissOld: (items: MissingIncome[]) => void;
  /** Proposta che si sta ignorando (chiave `instrumentId|date`), per disattivare il bottone. */
  dismissingKey: string | null;
  todayKey: string;
}

function quantityText(value: number): string {
  return value.toLocaleString("it-IT", { maximumFractionDigits: 4 });
}

export function MissingIncomeCard({
  missing,
  instrumentsById,
  currency,
  onRegister,
  onDismiss,
  onDismissOld,
  dismissingKey,
  todayKey,
}: MissingIncomeCardProps) {
  const [showAll, setShowAll] = React.useState(false);
  const oldBefore = monthsAgoKey(todayKey, OLD_MISSING_INCOME_MONTHS);
  const old = missing.filter((m) => m.date < oldBefore);
  const shown = showAll ? missing : missing.slice(0, MISSING_INCOME_LIMIT);
  const count = missing.length;

  return (
    <PanelSection icon={CircleAlertIcon} title="Da registrare" color="var(--neg)">
      <div className="flex flex-col gap-3">
        <p className="max-w-prose text-sm text-muted-foreground">
          {count === 1 ? "Un provento" : `${count} proventi`}
          {" che probabilmente hai incassato: avevi le quote il giorno dello stacco, ma non c'è"} un dividendo o una cedola registrati vicino a quella data. Controlla l&apos;importo netto sull&apos;estratto del broker.
        </p>
        <ul className="flex flex-col divide-y divide-border">
          {shown.map((item) => {
            const instrument = instrumentsById.get(item.instrumentId);
            const key = `${item.instrumentId}|${item.date}`;
            return (
              <li key={key} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 text-sm">
                  <p className="truncate font-medium text-foreground">{instrument?.name ?? "Strumento"}</p>
                  <p className="text-muted-foreground">
                    {item.kind === "cedola" ? "Cedola" : "Stacco"} del {formatDateWithYear(item.date)} · {quantityText(item.quantity)}{" "}
                    {item.kind === "cedola" ? "di nominale" : "quote"}
                  </p>
                  <p className="tabular-nums text-foreground">
                    {formatCurrency(item.gross, instrument?.currency ?? currency)} lordi
                    {item.estimatedTax !== null ? (
                      <span className="text-muted-foreground"> · ritenuta stimata {formatCurrency(item.estimatedTax, currency)}</span>
                    ) : null}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" onClick={() => onRegister(item)}>
                    Registra
                  </Button>
                  <Button size="sm" variant="ghost" disabled={dismissingKey === key} onClick={() => onDismiss(item)}>
                    Ignora
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap gap-2">
          {count > MISSING_INCOME_LIMIT ? (
            <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Mostra meno" : `Mostra tutte (${count})`}
            </Button>
          ) : null}
          {old.length > 1 ? (
            <Button variant="ghost" size="sm" disabled={dismissingKey !== null} onClick={() => onDismissOld(old)}>
              Ignora le {old.length} più vecchie di un anno
            </Button>
          ) : null}
        </div>
      </div>
    </PanelSection>
  );
}
