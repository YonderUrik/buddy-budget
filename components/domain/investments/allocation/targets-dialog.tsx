"use client";

/**
 * Dialog "Obiettivo": pesi per strumento che devono fare 100%. Parte dall'obiettivo salvato o dai pesi attuali;
 * si possono aggiungere strumenti non ancora posseduti (es. un ETF che vuoi iniziare a comprare).
 */

import * as React from "react";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Instrument } from "@/lib/db/schema/investments";
import type { TargetInput } from "@/lib/investments/allocation";
import { useUpdateTargetsMutation } from "@/lib/queries/investments";
import { MAX_TARGETS } from "@/lib/validation/investments";
import { cn } from "@/lib/utils";
import { InstrumentPicker } from "../instrument-picker";

/** Tolleranza sulla somma in punti percentuali (campi a un decimale). */
const SUM_TOLERANCE_PERCENT = 0.01;

interface TargetRow {
  instrument: Instrument;
  text: string;
}

function toText(weight: number): string {
  return String(Math.round(weight * 1000) / 10).replace(".", ",");
}

function parsePercent(text: string): number {
  const value = Number(text.replace(",", ".").trim() || "0");
  return Number.isFinite(value) ? value : NaN;
}

function formatPercent(value: number): string {
  return `${(Math.round(value * 10) / 10).toString().replace(".", ",")}%`;
}

export interface TargetsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pesi di partenza: l'obiettivo salvato o, se non c'è, i pesi attuali arrotondati. */
  initial: TargetInput[];
  /** true se esiste già un obiettivo salvato (mostra "Togli l'obiettivo"). */
  hasSaved: boolean;
  instrumentsById: Map<string, Instrument>;
  suggestions: Instrument[];
  currency: string;
}

export function TargetsDialog(props: TargetsDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-lg">{props.open ? <TargetsForm {...props} /> : null}</DialogContent>
    </Dialog>
  );
}

function TargetsForm({ onOpenChange, initial, hasSaved, instrumentsById, suggestions, currency }: TargetsDialogProps) {
  const update = useUpdateTargetsMutation();
  const [rows, setRows] = React.useState<TargetRow[]>(() =>
    initial
      .map((t) => ({ instrument: instrumentsById.get(t.instrumentId), text: toText(t.weight) }))
      .filter((r): r is TargetRow => r.instrument !== undefined)
  );
  const values = rows.map((r) => parsePercent(r.text));
  const sum = values.reduce((s, v) => s + (v || 0), 0);
  const remainder = 100 - sum;
  const valid = rows.length > 0 && values.every((v) => v > 0 && v <= 100) && Math.abs(remainder) <= SUM_TOLERANCE_PERCENT;
  const last = rows.at(-1);

  function setText(index: number, text: string) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, text } : r)));
  }

  function add(instrument: Instrument) {
    if (rows.some((r) => r.instrument.id === instrument.id) || rows.length >= MAX_TARGETS) return;
    setRows((prev) => [...prev, { instrument, text: remainder > 0 ? toText(remainder / 100) : "" }]);
  }

  function fillRemainder() {
    if (!last) return;
    const lastValue = parsePercent(last.text) || 0;
    setText(rows.length - 1, toText((lastValue + remainder) / 100));
  }

  function save(targets: TargetInput[]) {
    update.mutate({ targets }, { onSuccess: () => onOpenChange(false) });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Obiettivo di allocazione</DialogTitle>
        <DialogDescription>
          Quanto vuoi che pesi ogni strumento sul totale. Serve per vedere quanto ti sei allontanato e dove mettere il prossimo
          versamento.
        </DialogDescription>
      </DialogHeader>
      <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
        {rows.map((row, index) => (
          <li key={row.instrument.id} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm text-foreground">{row.instrument.name}</span>
            <Input
              inputMode="decimal"
              className="h-8 w-20 text-right tabular-nums"
              value={row.text}
              onChange={(e) => setText(index, e.target.value)}
              aria-label={`Peso obiettivo di ${row.instrument.name} in percentuale`}
            />
            <span className="text-sm text-muted-foreground">%</span>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={`Togli ${row.instrument.name}`}
              onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
            >
              <XIcon className="size-4" aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>
      <InstrumentPicker
        value={null}
        onChange={add}
        defaultCurrency={currency}
        suggestions={suggestions.filter((s) => !rows.some((r) => r.instrument.id === s.id))}
        placeholder="Aggiungi uno strumento"
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className={cn("tabular-nums", Math.abs(remainder) <= SUM_TOLERANCE_PERCENT ? "text-muted-foreground" : "text-destructive")}>
          Totale {formatPercent(sum)}
          {Math.abs(remainder) > SUM_TOLERANCE_PERCENT ? (remainder > 0 ? ` · mancano ${formatPercent(remainder)}` : ` · ${formatPercent(-remainder)} di troppo`) : ""}
        </span>
        {last && Math.abs(remainder) > SUM_TOLERANCE_PERCENT && (parsePercent(last.text) || 0) + remainder > 0 ? (
          <Button variant="ghost" size="sm" onClick={fillRemainder}>
            {remainder > 0 ? "Aggiungi" : "Togli"} la differenza a {last.instrument.name.length > 24 ? "l'ultimo" : last.instrument.name}
          </Button>
        ) : null}
      </div>
      {update.isError ? <p className="text-sm text-destructive">{update.error.message}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {hasSaved ? (
          <Button variant="ghost" className="text-muted-foreground" disabled={update.isPending} onClick={() => save([])}>
            Togli l&apos;obiettivo
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={update.isPending}>
            Annulla
          </Button>
          <Button
            disabled={!valid || update.isPending}
            onClick={() => save(rows.map((r, i) => ({ instrumentId: r.instrument.id, weight: Math.round(values[i] * 10) / 1000 })))}
          >
            {update.isPending ? "Salvo…" : "Salva"}
          </Button>
        </div>
      </div>
    </>
  );
}
