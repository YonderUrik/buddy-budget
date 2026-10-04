"use client";

/**
 * Ultimo passo dell'import: cosa succederà (operazioni nuove, già presenti e saltate, errori che bloccano, strumenti
 * da aggiungere) e, dopo la conferma, l'esito.
 */

import { AlertTriangleIcon, CheckCircle2Icon } from "lucide-react";
import type { ImportRow } from "@/lib/investments/import/normalize";
import type { ImportResult } from "@/lib/investments/import/types";

export interface ImportSummaryStepProps {
  result: ImportResult;
  /** Righe lette dal file (per contare avvisi e scarti a monte dell'anteprima). */
  rows: ImportRow[];
  /** Strumenti che verranno aggiunti al catalogo. */
  newInstruments: number;
  /** L'import è stato eseguito (non è più un'anteprima). */
  done: boolean;
}

/** Errori elencati per riga. */
const MAX_LISTED_ERRORS = 8;

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col rounded-lg border px-3 py-2">
      <span className="font-heading text-xl font-medium tabular-nums text-foreground">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export function ImportSummaryStep({ result, rows, newInstruments, done }: ImportSummaryStepProps) {
  if (done) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <CheckCircle2Icon className="size-8 text-pos" aria-hidden="true" />
        <p className="font-heading text-lg font-medium text-foreground">
          {result.inserted === 1 ? "Importata 1 operazione" : `Importate ${result.inserted} operazioni`}
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {result.replacement ? `${result.replacement.statements === 1 ? "1 rendiconto precedente sostituito" : `${result.replacement.statements} rendiconti precedenti sostituiti`} (${result.replacement.operations} operazioni). ` : ""}
          {result.instrumentsCreated > 0 ? `${result.instrumentsCreated} strumenti aggiunti. ` : ""}
          {result.counts.duplicate > 0 ? `${result.counts.duplicate} erano già presenti e sono state saltate. ` : ""}
          I prezzi storici si scaricano in background: il grafico si completa entro qualche minuto.
        </p>
      </div>
    );
  }

  const errors = result.rows.filter((r) => r.status === "error");
  const discarded = rows.filter((r) => r.status !== "ok").length;
  const freeShares = rows.filter((r) => r.status === "ok" && r.operation.price === 0 && r.operation.type === "acquisto").length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        <Stat value={result.counts.new} label="da importare" />
        <Stat value={result.counts.duplicate} label="già presenti" />
        <Stat value={newInstruments} label="strumenti nuovi" />
      </div>
      {result.replacement ? <p role="status" className="rounded-lg border p-3 text-sm">Questo file sostituirà {result.replacement.statements === 1 ? "1 rendiconto" : `${result.replacement.statements} rendiconti`} e {result.replacement.operations} operazioni nel periodo {result.replacement.from} – {result.replacement.to}. I periodi esterni restano invariati. Se i controlli falliscono, nessun dato verrà sostituito.</p> : null}
      <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
        {result.counts.duplicate > 0 ? <li>Le operazioni già presenti vengono saltate: puoi reimportare lo stesso file senza creare doppioni.</li> : null}
        {freeShares > 0 ? <li>{freeShares} acquisti a prezzo zero (quote ricevute gratis, es. staking): abbassano il prezzo medio.</li> : null}
        {discarded > 0 ? <li>{discarded} righe del file sono state scartate al passo Colonne.</li> : null}
      </ul>
      {errors.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
            <AlertTriangleIcon className="size-4" aria-hidden="true" />
            {errors.length === 1 ? "1 riga da correggere" : `${errors.length} righe da correggere`}: finché ci sono errori non si importa nulla
          </p>
          <ul className="flex flex-col gap-0.5 text-xs text-foreground">
            {errors.slice(0, MAX_LISTED_ERRORS).map((row) => (
              <li key={row.line}>
                Riga {row.line}: {row.message}
              </li>
            ))}
            {errors.length > MAX_LISTED_ERRORS ? <li>…e altre {errors.length - MAX_LISTED_ERRORS}</li> : null}
          </ul>
          <p className="text-xs text-muted-foreground">Correggi il file o escludi lo strumento al passo precedente.</p>
        </div>
      ) : null}
    </div>
  );
}
