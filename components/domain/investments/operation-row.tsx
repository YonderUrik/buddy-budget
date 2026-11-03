"use client";
import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";

/**
 * Riga di un'operazione: tipo, strumento, data con l'anno, quantità e prezzo; a destra l'importo e quanto ha reso.
 * Per un acquisto il guadagno è sulle quote ancora possedute al prezzo di oggi, per una vendita è il realizzato.
 */

import { useState } from "react";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QUANTITY_EPSILON } from "@/lib/calc/investments";
import type { Instrument, InvestmentTransaction } from "@/lib/db/schema/investments";
import type { OperationInsight } from "@/lib/investments/operations-history";
import { TRANSACTION_TYPE_LABELS } from "@/lib/investments/labels";

import { useBrokerStatementsQuery } from "@/lib/queries/investments";
import { DeleteImportedOperationDialog } from "./delete-imported-operation-dialog";
import { GainText } from "./gain-text";
import { InstrumentIcon } from "./instrument-icon";
import { privateNumberFormat } from "@/lib/format";






/** Nota sulle quote di un acquisto poi in parte vendute. */


function GainCell({ insight, currency }: { insight: OperationInsight<InvestmentTransaction>; currency: string }) {
  if (insight.gain !== null) return <GainText gain={insight.gain} pct={insight.gainPct} currency={currency} className="text-xs" />;
  if (insight.transaction.type !== "acquisto") return null;
  const text = insight.remainingQuantity <= QUANTITY_EPSILON ? "Quote vendute" : "Senza prezzo di oggi";
  return <span className="text-xs text-muted-foreground">{text}</span>;
}

export interface OperationRowProps {
  insight: OperationInsight<InvestmentTransaction>;
  instrument: Instrument | undefined;
  /** Where the operation comes from (broker or portfolio), as a small label; omitted when everything comes from one place. */
  sourceLabel?: string;
  currency: string;
  deleting: boolean;
  onEdit?: (transaction: InvestmentTransaction) => void;
  onDelete: (transaction: InvestmentTransaction, options: { imported: boolean }) => void;
}

export function OperationRow({ insight, instrument, sourceLabel, currency, deleting, onEdit, onDelete }: OperationRowProps) {
  const { locale: formattingLocale } = useLocalization();
  const { formatCurrency, formatDateWithYear } = localizedFormats(formattingLocale);
  function describe(t: InvestmentTransaction, instrument: Instrument | undefined): string {
  const currency = instrument?.currency ?? "";
  if (t.type === "rettifica") return tr("Nessun movimento di cassa · base trasferita {0}", { 0: formatCurrency(Number(t.grossAmount ?? 0), currency || "EUR") });
  if (t.type === "split") return tr("ogni quota diventa {0}", { 0: QUANTITY_FORMAT.format(Number(t.quantity)) });
  if (t.type === "dividendo" || t.type === "cedola") {
    return tr("{0} lordi", { 0: formatCurrency(Number(t.grossAmount ?? 0), currency || "EUR") });
  }
  const unit = instrument?.priceUnit === "percentuale_nominale" ? "% " : " ";
  return tr("{0} × {1}{2}{3}", { 0: QUANTITY_FORMAT.format(Number(t.quantity)), 1: PRICE_FORMAT.format(Number(t.price)), 2: unit, 3: currency });
}
  function remainingNote(insight: OperationInsight<InvestmentTransaction>): string | null {
  const t = insight.transaction;
  if (t.type !== "acquisto" || insight.remainingQuantity <= QUANTITY_EPSILON) return null;
  const bought = Number(t.quantity);
  if (bought - insight.remainingQuantity <= QUANTITY_EPSILON) return null;
  return tr("ne restano {0}", { 0: REMAINING_FORMAT.format(insight.remainingQuantity) });
}
  const QUANTITY_FORMAT = privateNumberFormat(formattingLocale, { maximumFractionDigits: 6 });
  const REMAINING_FORMAT = privateNumberFormat(formattingLocale, { maximumFractionDigits: 4 });
  const PRICE_FORMAT = privateNumberFormat(formattingLocale);

  const { t: tr } = useLocalization();
  const t = insight.transaction;
  const statements = useBrokerStatementsQuery();
  const reconciled = statements.data?.statements.some((s) => s.portfolioId === t.portfolioId) ?? false;
  // From a broker statement or connection: it cannot be edited (the next import would contradict it), only deleted.
  const imported = Boolean(t.statementAccountKey) || reconciled;
  const [confirming, setConfirming] = useState(false);
  const capitalAdjustment = t.type === "rettifica";
  const amount = t.type === "acquisto" ? insight.paid : insight.received;
  const details = [
    formatDateWithYear(t.date),
    describe(t, instrument),
    Number(t.fees) > 0 ? tr("commissioni {0}", {0: PRICE_FORMAT.format(Number(t.fees))}) : null,
    remainingNote(insight),
  ].filter(Boolean);
  return (
    <li className="flex items-center gap-3 px-4 py-3 sm:px-6">
      {instrument ? <InstrumentIcon type={instrument.type} name={instrument.name} instrumentId={instrument.id} size="sm" className="hidden sm:flex" /> : null}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Badge variant={t.type === "vendita" || t.type === "rimborso" ? "outline" : "secondary"}>
            {tr(TRANSACTION_TYPE_LABELS[t.type])}
          </Badge>
          <p className="truncate text-sm font-medium text-foreground">{instrument?.name ?? tr("Strumento")}</p>
        </div>
        {/* The label and the details wrap as two blocks, never in the middle of the details. */}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
          {sourceLabel ? (
            <Badge variant="outline" className="h-5 max-w-48 truncate font-normal text-text-2">
              {tr(sourceLabel)}
            </Badge>
          ) : null}
          <p>{details.join(" · ")}</p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
        {t.type === "split" || capitalAdjustment ? null : (
          <span className="text-sm font-medium tabular-nums text-foreground">{formatCurrency(amount, currency)}</span>
        )}
        <GainCell insight={insight} currency={currency} />
      </div>
      {onEdit && !capitalAdjustment && !imported ? (
        <Button
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 text-muted-foreground hover:text-primary"
          aria-label={tr("Modifica operazione")}
          onClick={() => onEdit(t)}
        >
          <PencilIcon className="size-4" aria-hidden="true" />
        </Button>
      ) : null}
      <Button
        variant="ghost"
        size="icon"
        className="size-9 shrink-0"
        aria-label={tr("Elimina operazione")}
        disabled={deleting || capitalAdjustment}
        onClick={() => (imported ? setConfirming(true) : onDelete(t, { imported: false }))}
      >
        <Trash2Icon className="size-4" aria-hidden="true" />
      </Button>
      {imported ? (
        <DeleteImportedOperationDialog
          open={confirming}
          onOpenChange={setConfirming}
          name={instrument?.name ?? tr("Strumento")}
          onConfirm={() => { setConfirming(false); onDelete(t, { imported: true }); }}
        />
      ) : null}
    </li>
  );
}
