"use client";
import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";

/**
 * Tutte le righe lette di un CSV personale, per esito in tre schede (da importare, escluse, errori). Ogni riga è
 * compatta; toccandola si vede la riga originale. Usato dalla schermata «Righe da controllare».
 */

import { useState } from "react";
import { SearchCheckIcon } from "lucide-react";
import { PanelSection } from "@/components/domain/investments/light";
import { SegmentedControl } from "@/components/domain/shared";
import { Button } from "@/components/ui/button";
import { usePrivacy } from "@/components/privacy-provider";
import { defaultPreviewTab, type PreviewGroups, type PreviewTab } from "@/lib/personal-import/preview-groups";
import type { Preview } from "@/lib/personal-import/confirm";

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

export interface PersonalImportRowsProps {
  preview: Pick<Preview, "headers" | "currency" | "records">;
  groups: PreviewGroups;
}

export function PersonalImportRows({ preview, groups }: PersonalImportRowsProps) {
  const { t: tr } = useLocalization();
  const { hidden } = usePrivacy();
  const [tab, setTab] = useState<PreviewTab | null>(null);
  const [shown, setShown] = useState(PAGE_SIZE);
  const current = tab ?? defaultPreviewTab(groups);
  const options = ([
    { value: "importable", label: tr("Da importare · {0}", { 0: groups.importable.length }) },
    ...(groups.ignored.length > 0 ? [{ value: "ignored", label: tr("Escluse · {0}", { 0: groups.ignored.length }) }] : []),
    ...(groups.errors.length > 0 ? [{ value: "errors", label: tr("Errori · {0}", { 0: groups.errors.length }) }] : []),
  ] as { value: PreviewTab; label: string }[]);
  const rows = groups[current];

  return (
    <PanelSection icon={SearchCheckIcon} title={tr("Tutte le righe")} color="var(--swatch-slate)" description={tr("{0} righe lette: {1} movimenti, {2} operazioni, {3} escluse. Non salvo nulla finché non scegli.", { 0: preview.records.length, 1: groups.cash, 2: groups.investments, 3: groups.ignored.length })} className="gap-4">
      {hidden ? <p className="text-sm text-muted-foreground">{tr("Disattiva «Nascondi gli importi» per consultare il dettaglio.")}</p> : (
        <>
          <div className="max-w-full overflow-x-auto">
            <SegmentedControl options={options} value={current} onChange={(value) => { setTab(value); setShown(PAGE_SIZE); }} ariaLabel={tr("Righe per esito")} />
          </div>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tr("Nessuna riga in questa scheda.")}</p>
          ) : (
            <div>
              {rows.slice(0, shown).map((record) => <RecordRow key={record.key} record={record} headers={preview.headers} currency={preview.currency} />)}
            </div>
          )}
          {rows.length > shown ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">{"1–"}{shown}{" "}{tr("di")}{" "}{rows.length}</span>
              <Button variant="outline" size="sm" onClick={() => setShown((n) => n + PAGE_SIZE)}>{tr("Mostra altre")}</Button>
            </div>
          ) : null}
        </>
      )}
    </PanelSection>
  );
}
