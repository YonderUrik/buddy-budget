"use client";

/** Ultimo passo dell'import: cosa cambierà (nuove, aggiornate, già presenti), errori che bloccano e, a fine import, l'esito. */

import { AlertTriangleIcon, CheckCircle2Icon } from "lucide-react";
import type { SnapshotImportPlan } from "@/lib/pension/import/plan";
import { formatShortDateKey, money } from "../pension-format";

export interface PensionImportSummaryStepProps {
  plan: SnapshotImportPlan;
  currency: string;
  /** Righe del file scartate al passo Colonne (data o importi non validi). */
  discarded: number;
  /** Conteggi dell'import eseguito; null finché è un'anteprima. */
  done: SnapshotImportPlan["counts"] | null;
}

const MAX_LISTED = 6;
const STATUS_LABELS = { new: "Nuova", update: "Aggiorna", unchanged: "Già presente", error: "Errore" } as const;

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col rounded-lg border px-3 py-2">
      <span className="font-heading text-xl font-medium tabular-nums text-foreground">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export function PensionImportSummaryStep({ plan, currency, discarded, done }: PensionImportSummaryStepProps) {
  if (done) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <CheckCircle2Icon className="size-8 text-pos" aria-hidden="true" />
        <p className="font-heading text-lg font-medium text-foreground">
          {done.new + done.update === 0 ? "Niente da cambiare" : `${done.new} aggiunte, ${done.update} aggiornate`}
        </p>
        {done.unchanged > 0 ? <p className="max-w-sm text-sm text-muted-foreground">{done.unchanged} erano già presenti e sono state saltate.</p> : null}
      </div>
    );
  }

  const updates = plan.rows.filter((r) => r.status === "update");
  const errors = plan.rows.filter((r) => r.status === "error");
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        <Stat value={plan.counts.new} label="da aggiungere" />
        <Stat value={plan.counts.update} label="da aggiornare" />
        <Stat value={plan.counts.unchanged} label="già presenti" />
      </div>
      <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
        <li>Una fotografia con la stessa data di una già salvata ne sostituisce i valori; se sono identici viene saltata, quindi puoi reimportare lo stesso file senza doppioni.</li>
        {discarded > 0 ? <li>{discarded} righe del file sono state scartate al passo Colonne.</li> : null}
      </ul>
      {updates.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 font-medium">{STATUS_LABELS.update}</th>
                <th className="px-2 py-1.5 text-right font-medium">Controvalore prima</th>
              </tr>
            </thead>
            <tbody>
              {updates.slice(0, MAX_LISTED).map((row) => (
                <tr key={row.line} className="border-t">
                  <td className="px-2 py-1.5 whitespace-nowrap">{formatShortDateKey(row.date)}</td>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums">{row.previous ? money(row.previous.value, currency) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {updates.length > MAX_LISTED ? <p className="border-t px-2 py-1.5 text-xs text-muted-foreground">…e altre {updates.length - MAX_LISTED}</p> : null}
        </div>
      ) : null}
      {plan.error || errors.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
            <AlertTriangleIcon className="size-4" aria-hidden="true" />
            Finché ci sono errori non si importa nulla
          </p>
          <ul className="flex flex-col gap-0.5 text-xs text-foreground">
            {plan.error ? <li>{plan.error}</li> : null}
            {errors.slice(0, MAX_LISTED).map((row) => (
              <li key={row.line}>
                Riga {row.line}: {row.message}
              </li>
            ))}
            {errors.length > MAX_LISTED ? <li>…e altre {errors.length - MAX_LISTED}</li> : null}
          </ul>
          <p className="text-xs text-muted-foreground">Correggi il file e ricaricalo.</p>
        </div>
      ) : null}
    </div>
  );
}
