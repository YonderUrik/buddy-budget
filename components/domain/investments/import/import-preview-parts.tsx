"use client";

/**
 * Pezzi dell'anteprima (secondo passo): intestazione del file letto, numeri in evidenza, prime operazioni e righe che
 * non vengono importate con il motivo e cosa fare. Condivisi tra rendiconti dei broker e CSV mappati a colonne.
 */

import { CheckCircle2Icon, FileTextIcon } from "lucide-react";
import type { ActivityIssue } from "@/lib/investments/import/interactive-brokers";
import { explainRowMessage } from "@/lib/investments/import/messages";
import type { ImportRow } from "@/lib/investments/import/normalize";
import { TRANSACTION_TYPE_LABELS } from "@/lib/investments/labels";
import { cn } from "@/lib/utils";
import { DialogSection } from "../dialog-parts";
import { ImportNotice } from "./import-notice";

export interface PreviewHeaderProps {
  fileName: string | null;
  /** Nome del formato riconosciuto; `null` se il formato non è noto. */
  providerName: string | null;
}

/** Quale file è stato letto e come è stato riconosciuto. */
export function PreviewHeader({ fileName, providerName }: PreviewHeaderProps) {
  return (
    <div className="flex flex-col gap-1">
      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
        <FileTextIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 truncate">{fileName ?? "Testo incollato"}</span>
      </p>
      {providerName ? (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <CheckCircle2Icon className="size-4 shrink-0 text-pos" aria-hidden="true" />
          Formato riconosciuto: {providerName}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Non riconosco il formato di questo file: indicami cosa contiene ogni colonna.</p>
      )}
    </div>
  );
}

export interface PreviewNumber {
  value: number;
  label: string;
  /** Evidenzia il numero se è un problema da guardare (es. righe non importate). */
  attention?: boolean;
}

/** Numeri grandi affiancati con la loro etichetta, separati da filettature (nessun riquadro). */
export function PreviewNumbers({ items }: { items: PreviewNumber[] }) {
  return (
    <dl className="grid divide-x" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-0.5 px-3 first:pl-0 last:pr-0">
          <dd className={cn("font-heading text-3xl font-medium tabular-nums", item.attention && item.value > 0 ? "text-foreground" : item.value === 0 ? "text-muted-foreground" : "text-foreground")}>
            {item.value}
          </dd>
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
        </div>
      ))}
    </dl>
  );
}

const NUMBER_FORMAT = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 8 });

function dateLabel(date: string): string {
  return date.split("-").reverse().join("/");
}

export interface ImportRowsPreviewProps {
  rows: ImportRow[];
  /** Righe valide mostrate in anteprima. */
  limit?: number;
}

/** Le prime operazioni lette, come verranno importate: tabella su schermi larghi, elenco compatto su telefono. */
export function ImportRowsPreview({ rows, limit = 6 }: ImportRowsPreviewProps) {
  const ok = rows.flatMap((r) => (r.status === "ok" ? [r] : []));
  if (ok.length === 0) return null;
  const shown = ok.slice(0, limit);
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col divide-y sm:hidden">
        {shown.map((row) => (
          <li key={row.line} className="flex items-start justify-between gap-3 py-2 text-sm">
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium text-foreground">{row.identity.symbol ?? row.identity.isin ?? row.identity.name}</span>
              <span className="text-xs text-muted-foreground">
                {dateLabel(row.operation.date)} · {TRANSACTION_TYPE_LABELS[row.operation.type]}
              </span>
            </span>
            <span className="shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
              {row.operation.quantity ? `${NUMBER_FORMAT.format(row.operation.quantity)} × ` : ""}
              {NUMBER_FORMAT.format(row.operation.grossAmount ?? row.operation.price)}
            </span>
          </li>
        ))}
      </ul>
      <table className="hidden w-full text-left text-sm sm:table">
        <thead className="text-xs text-muted-foreground">
          <tr className="border-b">
            <th className="py-1.5 pr-2 font-medium">Data</th>
            <th className="px-2 py-1.5 font-medium">Tipo</th>
            <th className="px-2 py-1.5 font-medium">Strumento</th>
            <th className="px-2 py-1.5 text-right font-medium">Quantità</th>
            <th className="py-1.5 pl-2 text-right font-medium">Prezzo o importo</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((row) => (
            <tr key={row.line} className="border-b last:border-b-0">
              <td className="whitespace-nowrap py-1.5 pr-2">{dateLabel(row.operation.date)}</td>
              <td className="px-2 py-1.5">{TRANSACTION_TYPE_LABELS[row.operation.type]}</td>
              <td className="max-w-48 truncate px-2 py-1.5">{row.identity.symbol ?? row.identity.isin ?? row.identity.name}</td>
              <td className="px-2 py-1.5 text-right font-mono tabular-nums">{row.operation.quantity ? NUMBER_FORMAT.format(row.operation.quantity) : "—"}</td>
              <td className="py-1.5 pl-2 text-right font-mono tabular-nums">{NUMBER_FORMAT.format(row.operation.grossAmount ?? row.operation.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {ok.length > limit ? <p className="text-xs text-muted-foreground">…e altre {ok.length - limit} operazioni: le vedi tutte dopo l&apos;import, in Operazioni.</p> : null}
    </div>
  );
}

/** Righe elencate per gruppo; le altre si riassumono in un conteggio. */
const MAX_LISTED = 5;

/** Righe del file che non vengono importate: quelle da correggere (errori) e quelle che salto di proposito. */
export function SkippedRows({ rows }: { rows: ImportRow[] }) {
  const problems = rows.flatMap((r) => (r.status === "ok" ? [] : [r]));
  if (problems.length === 0) return null;
  const errors = problems.filter((r) => r.status === "error");
  // Le righe saltate di proposito si raggruppano per motivo: 40 «Imposta di bollo» sono una riga sola.
  const skipped = new Map<string, number[]>();
  for (const row of problems) if (row.status === "skipped") skipped.set(row.message, [...(skipped.get(row.message) ?? []), row.line]);
  return (
    <DialogSection title={`${problems.length} ${problems.length === 1 ? "riga non importata" : "righe non importate"}`}>
      {errors.length > 0 ? (
        <div className="flex flex-col gap-3">
          {errors.slice(0, MAX_LISTED).map((row) => {
            const e = explainRowMessage(row.message);
            return <ImportNotice key={row.line} tone="warning" title={`Riga ${row.line}: ${e.text}`} hint={e.hint} />;
          })}
          {errors.length > MAX_LISTED ? <p className="text-sm text-muted-foreground">…e altre {errors.length - MAX_LISTED} righe con lo stesso tipo di problema.</p> : null}
        </div>
      ) : null}
      {skipped.size > 0 ? (
        <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
          {[...skipped.entries()].slice(0, MAX_LISTED).map(([message, lines]) => (
            <li key={message}>
              {explainRowMessage(message).text} <span className="text-xs">({lines.length === 1 ? `riga ${lines[0]}` : `${lines.length} righe`})</span>
            </li>
          ))}
          {skipped.size > MAX_LISTED ? <li>…e altri {skipped.size - MAX_LISTED} tipi di riga.</li> : null}
        </ul>
      ) : null}
    </DialogSection>
  );
}

/** Eventi del rendiconto che non vengono importati e vanno guardati a mano (corporate action, interessi...). */
export function StatementWarnings({ warnings }: { warnings: ActivityIssue[] }) {
  if (warnings.length === 0) return null;
  return (
    <DialogSection>
      <ImportNotice
        tone="warning"
        title={`${warnings.length} ${warnings.length === 1 ? "voce del rendiconto non viene importata" : "voci del rendiconto non vengono importate"}`}
        hint="Se contano per i tuoi numeri, registrale a mano da «Registra»."
      >
        <ul className="flex flex-col gap-1">
          {warnings.slice(0, MAX_LISTED).map((w) => (
            <li key={`${w.line}-${w.message}`}>
              Riga {w.line} · {w.section}: {w.message}
            </li>
          ))}
          {warnings.length > MAX_LISTED ? <li>…e altre {warnings.length - MAX_LISTED}.</li> : null}
        </ul>
      </ImportNotice>
    </DialogSection>
  );
}
