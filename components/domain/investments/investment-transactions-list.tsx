"use client";

/** Elenco delle operazioni registrate, dalla più recente, con eliminazione (il server rifiuta se renderebbe negative le quote). */

import { Trash2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Instrument, InvestmentTransaction } from "@/lib/db/schema/investments";
import { TRANSACTION_TYPE_LABELS } from "@/lib/investments/labels";
import { formatCurrency, formatShortDate } from "@/lib/format";

const QUANTITY_FORMAT = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 6 });
/** Operazioni mostrate prima di "Mostra tutte". */
export const RECENT_TRANSACTIONS_LIMIT = 10;

export interface InvestmentTransactionsListProps {
  transactions: InvestmentTransaction[];
  instrumentsById: Map<string, Instrument>;
  showAll: boolean;
  onToggleShowAll: () => void;
  onDelete: (transaction: InvestmentTransaction) => void;
  deletingId?: string | null;
}

function describe(t: InvestmentTransaction, instrument: Instrument | undefined): string {
  const currency = instrument?.currency ?? "";
  if (t.type === "dividendo" || t.type === "cedola") {
    return `${formatCurrency(Number(t.grossAmount ?? 0), currency || "EUR")} lordi`;
  }
  const unit = instrument?.priceUnit === "percentuale_nominale" ? "% " : " ";
  return `${QUANTITY_FORMAT.format(Number(t.quantity))} × ${Number(t.price).toLocaleString("it-IT")}${unit}${currency}`;
}

export function InvestmentTransactionsList({
  transactions,
  instrumentsById,
  showAll,
  onToggleShowAll,
  onDelete,
  deletingId,
}: InvestmentTransactionsListProps) {
  const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date));
  const visible = showAll ? sorted : sorted.slice(0, RECENT_TRANSACTIONS_LIMIT);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Operazioni</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {sorted.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">Nessuna operazione registrata.</p>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((t) => {
              const instrument = instrumentsById.get(t.instrumentId);
              return (
                <li key={t.id} className="flex items-center gap-3 px-4 py-3 sm:px-6">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={t.type === "vendita" || t.type === "rimborso" ? "outline" : "secondary"}>
                        {TRANSACTION_TYPE_LABELS[t.type]}
                      </Badge>
                      <p className="truncate text-sm font-medium text-foreground">{instrument?.name ?? "Strumento"}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatShortDate(t.date)} · {describe(t, instrument)}
                      {Number(t.fees) > 0 ? ` · commissioni ${Number(t.fees).toLocaleString("it-IT")}` : ""}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 shrink-0"
                    aria-label="Elimina operazione"
                    disabled={deletingId === t.id}
                    onClick={() => onDelete(t)}
                  >
                    <Trash2Icon className="size-4" aria-hidden="true" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        {sorted.length > RECENT_TRANSACTIONS_LIMIT ? (
          <div className="border-t border-border px-4 py-2 sm:px-6">
            <Button variant="link" className="px-0" onClick={onToggleShowAll}>
              {showAll ? "Mostra solo le più recenti" : `Mostra tutte (${sorted.length})`}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
