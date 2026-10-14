"use client";
import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";

/**
 * Dettaglio dell'analisi di un file CSV personale: prima cosa ho trovato (conteggi) e cosa fare (errori), poi le righe
 * per esito in tre schede (da importare, escluse, errori). Ogni riga è compatta; toccandola si vede la riga originale.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircleIcon, SearchCheckIcon } from "lucide-react";
import { PanelSection } from "@/components/domain/investments/light";
import { SegmentedControl } from "@/components/domain/shared";
import { Button } from "@/components/ui/button";
import { usePrivacy } from "@/components/privacy-provider";

import { defaultPreviewTab, groupPreviewRecords, type PreviewTab } from "@/lib/personal-import/preview-groups";
import type { Preview } from "@/lib/personal-import/confirm";
import { personalImportApi } from "./personal-import-api";

type PreviewRecord = Preview["records"][number];

/** Righe mostrate per volta in una scheda. */
const PAGE_SIZE = 25;

const KIND_LABELS = { acquisto: "Acquisto", vendita: "Vendita", dividendo: "Dividendo", cedola: "Cedola" } as const;



/** Una riga: data, descrizione con tipo e numero di riga, importo; l'originale si apre al tocco. */
function RecordRow({ record, headers, currency }: { record: PreviewRecord; headers: string[]; currency: string }) {
  const { locale: formattingLocale } = useLocalization();
  const { formatCurrency } = localizedFormats(formattingLocale);
  function shortDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(formattingLocale, { day: "numeric", month: "short" });
}

  const { t: tr } = useLocalization();
  const o = record.outcome;
  const line = record.line ?? o.row + 2;
  let title: string;
  let sub: string;
  let amount: React.ReactNode = null;
  if (o.kind === "cash") {
    title = o.description;
    sub = `${o.transfer ? "Giroconto" : "Movimento"} · riga ${line}`;
    amount = <span className={o.amount < 0 ? "" : "text-pos"}>{formatCurrency(o.amount, o.currency)}</span>;
  } else if (o.kind === "investment") {
    title = o.name;
    sub = `${tr(KIND_LABELS[o.type])}${o.quantity ? tr(" · {0} × {1} {2}", { 0: o.quantity, 1: o.price, 2: o.currency }) : ""} · riga ${line}`;
    amount = o.grossAmount !== null ? <span className="text-pos">{formatCurrency(o.grossAmount, o.currency)}</span> : <span>{formatCurrency(-(o.quantity * o.price) * (o.type === "vendita" ? -1 : 1), o.currency)}</span>;
  } else {
    title = o.reason;
    sub = `Riga ${line}`;
  }
  return (
    <details className="group border-t py-2.5 first:border-t-0">
      <summary className="grid min-h-11 cursor-pointer list-none grid-cols-[3.25rem_1fr_auto] items-baseline gap-x-3 [&::-webkit-details-marker]:hidden">
        <span className="text-xs text-muted-foreground">{"date" in o ? shortDate(o.date) : ""}</span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-foreground">{tr(title)}</span>
          <span className="block truncate text-xs text-muted-foreground">{sub}</span>
        </span>
        <span className="text-sm font-medium tabular-nums">{amount}</span>
      </summary>
      <dl className="mt-2 flex flex-col gap-1 pl-[3.75rem] text-xs text-muted-foreground">
        {record.source.map((value, i) => (
          <div key={i}><dt className="inline font-medium">{headers[i] ?? tr("Colonna {0}", { 0: i + 1 })}{":"}</dt><dd className="inline break-all">{value}</dd></div>
        ))}
        {record.rate !== null ? <div>{tr("Cambio verso")}{" "}{currency}{":"}{record.rate}</div> : null}
      </dl>
    </details>
  );
}

export function PersonalImportPreview({ id }: { id: string }) {
  const { t: tr } = useLocalization();
  const { hidden } = usePrivacy();
  const [tab, setTab] = useState<PreviewTab | null>(null);
  const [shown, setShown] = useState(PAGE_SIZE);
  const { data, error, isPending } = useQuery({ queryKey: ["personal-import-preview", id], queryFn: () => personalImportApi<Preview>(`/${id}`), staleTime: 0 });
  if (isPending) return <p role="status" className="text-sm text-muted-foreground">{tr("Caricamento del dettaglio…")}</p>;
  if (error || !data) return <p role="alert" className="text-sm text-destructive">{error?.message ?? tr("Dettaglio non disponibile")}</p>;
  if (hidden) return <p className="text-sm text-muted-foreground">{tr("Disattiva «Nascondi gli importi» per consultare il dettaglio.")}</p>;

  const groups = groupPreviewRecords(data.records);
  const current = tab ?? defaultPreviewTab(groups);
  const options = ([
    { value: "importable", label: tr("Da importare · {0}", { 0: groups.importable.length }) },
    ...(groups.ignored.length > 0 ? [{ value: "ignored", label: tr("Escluse · {0}", { 0: groups.ignored.length }) }] : []),
    ...(groups.errors.length > 0 ? [{ value: "errors", label: tr("Errori · {0}", { 0: groups.errors.length }) }] : []),
  ] as { value: PreviewTab; label: string }[]);
  const rows = groups[current];
  const firstError = groups.errors[0]?.outcome;

  return (
    <PanelSection icon={SearchCheckIcon} title={tr("Cosa ho trovato")} color="var(--swatch-amber)" description={tr("{0} righe lette. Controlla e conferma: non salvo nulla finché non accetti.", {0: data.records.length})} className="gap-4">
      <dl className="flex gap-7">
        {[
          { value: groups.cash, label: tr("movimenti") },
          { value: groups.investments, label: tr("operazioni") },
          { value: groups.ignored.length, label: groups.ignored.length === 1 ? "esclusa" : "escluse" },
        ].map((item) => (
          <div key={item.label} className="flex flex-col">
            <dd className="font-heading text-2xl font-medium tabular-nums text-foreground">{item.value}</dd>
            <dt className="text-xs text-muted-foreground">{tr(item.label)}</dt>
          </div>
        ))}
      </dl>

      {groups.errors.length > 0 ? (
        <div role="alert" className="flex gap-3 rounded-xl bg-neg-soft p-3">
          <AlertCircleIcon className="mt-0.5 size-5 shrink-0 text-neg" aria-hidden="true" />
          <div className="flex flex-col gap-0.5 text-sm">
            <p className="font-medium text-foreground">{groups.errors.length === 1 ? tr("1 riga da correggere") : tr("{0} righe da correggere", {0: groups.errors.length})}</p>
            <p className="text-muted-foreground">
              {firstError && "reason" in firstError ? tr("Riga {0}: {1}. ", {0: groups.errors[0].line ?? firstError.row + 2, 1: firstError.reason}) : ""}{tr("Correggi il file e ricaricalo: finché ci sono errori non importo nulla.")}</p>
          </div>
        </div>
      ) : null}

      <div className="max-w-full overflow-x-auto">
        <SegmentedControl options={options} value={current} onChange={(value) => { setTab(value); setShown(PAGE_SIZE); }} ariaLabel={tr("Righe per esito")} />
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tr("Nessuna riga in questa scheda.")}</p>
      ) : (
        <div>
          {rows.slice(0, shown).map((record) => <RecordRow key={record.key} record={record} headers={data.headers} currency={data.currency} />)}
        </div>
      )}
      {rows.length > shown ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">{"1–"}{shown}{" "}{tr("di")}{" "}{rows.length}</span>
          <Button variant="outline" size="sm" onClick={() => setShown((n) => n + PAGE_SIZE)}>{tr("Mostra altre")}</Button>
        </div>
      ) : null}

      <details className="text-sm text-muted-foreground">
        <summary className="min-h-11 cursor-pointer content-center font-medium text-foreground">{tr("Cosa succede quando importo")}</summary>
        <div className="flex flex-col gap-2 pb-2">
          <p>{tr("Creo un conto dedicato (e un portafoglio, se serve) con saldo di partenza zero: carica lo storico completo oppure correggi il saldo dopo l'import. Gli strumenti nuovi avranno prezzi manuali.")}</p>
          <p>{tr("Le righe già importate con questo formato vengono saltate. Se descrizioni o colonne sono cambiate possono comparire doppioni: confrontali con lo storico. I cambi storici convertono i movimenti in")}{" "}{data.currency}{"."}</p>
        </div>
      </details>
    </PanelSection>
  );
}
