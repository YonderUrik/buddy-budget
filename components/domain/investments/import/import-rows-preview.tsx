"use client";

/**
 * Anteprima delle righe lette con la mappatura corrente: conteggi, prime operazioni come verranno importate e righe
 * scartate con il motivo. Si aggiorna a ogni cambio di colonna o formato.
 */

import { AlertTriangleIcon } from "lucide-react";
import type { ImportRow } from "@/lib/investments/import/normalize";
import { TRANSACTION_TYPE_LABELS } from "@/lib/investments/labels";

export interface ImportRowsPreviewProps {
  rows: ImportRow[];
  /** Righe valide mostrate in anteprima. */
  limit?: number;
}

/** Righe scartate elencate; le altre si riassumono in un conteggio. */
const MAX_LISTED_PROBLEMS = 5;
const NUMBER_FORMAT = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 8 });

export function ImportRowsPreview({ rows, limit = 6 }: ImportRowsPreviewProps) {
  const ok = rows.filter((r) => r.status === "ok");
  const problems = rows.filter((r) => r.status !== "ok");
  const warnings = ok.filter((r) => r.warnings.length > 0).length;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-foreground">
        <span className="font-medium tabular-nums">{ok.length}</span> operazioni lette su {rows.length} righe
        {problems.length > 0 ? `, ${problems.length} scartate` : ""}
        {warnings > 0 ? `, ${warnings} con un avviso` : ""}.
      </p>

      {ok.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 font-medium">Riga</th>
                <th className="px-2 py-1.5 font-medium">Data</th>
                <th className="px-2 py-1.5 font-medium">Tipo</th>
                <th className="px-2 py-1.5 font-medium">Strumento</th>
                <th className="px-2 py-1.5 text-right font-medium">Quantità</th>
                <th className="px-2 py-1.5 text-right font-medium">Prezzo / importo</th>
              </tr>
            </thead>
            <tbody>
              {ok.slice(0, limit).map((row) => (
                <tr key={row.line} className="border-t">
                  <td className="px-2 py-1.5 tabular-nums text-muted-foreground">{row.line}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{row.operation.date.split("-").reverse().join("/")}</td>
                  <td className="px-2 py-1.5">{TRANSACTION_TYPE_LABELS[row.operation.type]}</td>
                  <td className="max-w-40 truncate px-2 py-1.5">{row.identity.symbol ?? row.identity.isin ?? row.identity.name}</td>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                    {row.operation.quantity ? NUMBER_FORMAT.format(row.operation.quantity) : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                    {NUMBER_FORMAT.format(row.operation.grossAmount ?? row.operation.price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {problems.length > 0 ? (
        <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
          {problems.slice(0, MAX_LISTED_PROBLEMS).map((row) => (
            <li key={row.line} className="flex items-start gap-1.5">
              <AlertTriangleIcon className="mt-0.5 size-3 shrink-0 text-destructive" aria-hidden="true" />
              Riga {row.line}: {row.message}
            </li>
          ))}
          {problems.length > MAX_LISTED_PROBLEMS ? <li>…e altre {problems.length - MAX_LISTED_PROBLEMS}</li> : null}
        </ul>
      ) : null}
    </div>
  );
}
