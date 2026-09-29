"use client";

/**
 * Riga di un'operazione: tipo, strumento, data con l'anno, quantità e prezzo; a destra l'importo e quanto ha reso.
 * Per un acquisto il guadagno è sulle quote ancora possedute al prezzo di oggi, per una vendita è il realizzato.
 */

import { Trash2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QUANTITY_EPSILON } from "@/lib/calc/investments";
import type { Instrument, InvestmentTransaction } from "@/lib/db/schema/investments";
import type { OperationInsight } from "@/lib/investments/operations-history";
import { TRANSACTION_TYPE_LABELS } from "@/lib/investments/labels";
import { formatCurrency, formatDateWithYear } from "@/lib/format";
import { GainText } from "./gain-text";

const QUANTITY_FORMAT = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 6 });
const REMAINING_FORMAT = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 4 });

function describe(t: InvestmentTransaction, instrument: Instrument | undefined): string {
  const currency = instrument?.currency ?? "";
  if (t.type === "dividendo" || t.type === "cedola") {
    return `${formatCurrency(Number(t.grossAmount ?? 0), currency || "EUR")} lordi`;
  }
  const unit = instrument?.priceUnit === "percentuale_nominale" ? "% " : " ";
  return `${QUANTITY_FORMAT.format(Number(t.quantity))} × ${Number(t.price).toLocaleString("it-IT")}${unit}${currency}`;
}

/** Nota sulle quote di un acquisto poi in parte vendute. */
function remainingNote(insight: OperationInsight<InvestmentTransaction>): string | null {
  const t = insight.transaction;
  if (t.type !== "acquisto" || insight.remainingQuantity <= QUANTITY_EPSILON) return null;
  const bought = Number(t.quantity);
  if (bought - insight.remainingQuantity <= QUANTITY_EPSILON) return null;
  return `ne restano ${REMAINING_FORMAT.format(insight.remainingQuantity)}`;
}

function GainCell({ insight, currency }: { insight: OperationInsight<InvestmentTransaction>; currency: string }) {
  if (insight.gain !== null) return <GainText gain={insight.gain} pct={insight.gainPct} currency={currency} className="text-xs" />;
  if (insight.transaction.type !== "acquisto") return null;
  const text = insight.remainingQuantity <= QUANTITY_EPSILON ? "Quote vendute" : "Senza prezzo di oggi";
  return <span className="text-xs text-muted-foreground">{text}</span>;
}

export interface OperationRowProps {
  insight: OperationInsight<InvestmentTransaction>;
  instrument: Instrument | undefined;
  currency: string;
  deleting: boolean;
  onDelete: (transaction: InvestmentTransaction) => void;
}

export function OperationRow({ insight, instrument, currency, deleting, onDelete }: OperationRowProps) {
  const t = insight.transaction;
  const amount = t.type === "acquisto" ? insight.paid : insight.received;
  const details = [
    formatDateWithYear(t.date),
    describe(t, instrument),
    Number(t.fees) > 0 ? `commissioni ${Number(t.fees).toLocaleString("it-IT")}` : null,
    remainingNote(insight),
  ].filter(Boolean);
  return (
    <li className="flex items-center gap-3 px-4 py-3 sm:px-6">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Badge variant={t.type === "vendita" || t.type === "rimborso" ? "outline" : "secondary"}>
            {TRANSACTION_TYPE_LABELS[t.type]}
          </Badge>
          <p className="truncate text-sm font-medium text-foreground">{instrument?.name ?? "Strumento"}</p>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{details.join(" · ")}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
        <span className="text-sm font-medium tabular-nums text-foreground">{formatCurrency(amount, currency)}</span>
        <GainCell insight={insight} currency={currency} />
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-9 shrink-0"
        aria-label="Elimina operazione"
        disabled={deleting}
        onClick={() => onDelete(t)}
      >
        <Trash2Icon className="size-4" aria-hidden="true" />
      </Button>
    </li>
  );
}
