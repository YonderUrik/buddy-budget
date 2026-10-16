"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useLocalization } from "@/lib/localization/provider";
import type { PersonalImportListing } from "@/lib/queries/personal-imports";
import type { compareCorrection } from "@/lib/personal-import/correction";
import { personalImportApi } from "./personal-import-api";
import { readPersonalImportFile } from "./personal-import-upload";

type Comparison = Awaited<ReturnType<typeof compareCorrection>>;
export interface PersonalImportCorrectionProps {
  job: PersonalImportListing["jobs"][number];
  onSelect: (id: string | null) => void;
}

/** Reupload with feedback; keep the original until the user reviews and confirms a replacement. */
export function PersonalImportCorrection({ job, onSelect }: PersonalImportCorrectionProps) {
  const { t: tr, locale } = useLocalization();
  const client = useQueryClient();
  const [feedback, setFeedback] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const starting = job.status === "imported";
  const comparison = useQuery({ queryKey: ["personal-import-correction", job.id], enabled: job.status === "correction_ready", queryFn: () => personalImportApi<Comparison>(`/${job.id}?correction=1`), retry: false });
  async function act(action: "analyze" | "replace" | "discard") {
    setBusy(true); setError(null);
    try {
      let selected: string | null = job.id;
      if (action === "analyze") {
        if (!file) throw new Error(tr("Seleziona il file originale"));
        const loaded = await readPersonalImportFile(file);
        const next = await personalImportApi<{ id: string }>("", { csv: loaded.csv, name: "Correzione", correctionOf: job.id, feedback, consent, consentVersion: "openrouter-raw-zdr-v3" });
        selected = next.id;
      } else if (action === "replace") {
        await personalImportApi(`/${job.id}`, { action: "replace_import" });
      } else {
        await personalImportApi(`/${job.id}`, { action: "discard_correction" });
        selected = job.correctionOf ?? null;
      }
      await client.invalidateQueries();
      onSelect(selected);
    } catch (e) { setError(e instanceof Error ? e.message : tr("Operazione non riuscita")); }
    finally { setBusy(false); }
  }
  const data = comparison.data;
  const money = (value: number) => new Intl.NumberFormat(locale, { style: "currency", currency: data?.currency ?? "EUR" }).format(value);
  return <section className="flex flex-col gap-4 rounded-2xl border p-4 sm:p-6" aria-label={tr("Correggi importazione")}>
    <h2 className="font-heading text-2xl">{tr(starting ? "Il risultato è sbagliato" : "Correzione dell’importazione")}</h2>
    <p>{tr("I movimenti originali restano invariati fino alla conferma della sostituzione.")}</p>
    {starting ? <form className="flex flex-col gap-4" onSubmit={e => { e.preventDefault(); void act("analyze"); }}>
      <label className="flex flex-col gap-2">{tr("Che cosa è sbagliato?")}<textarea required maxLength={2000} value={feedback} onChange={e => setFeedback(e.target.value)} className="min-h-24 rounded-md border p-3" /></label>
      <label className="flex flex-col gap-2">{tr("Ricarica il file originale CSV o Excel")}<input required type="file" accept=".csv,.xlsx,.txt,.tsv" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
      <p className="text-sm text-muted-foreground">{tr("Il file precedente è stato eliminato dopo l’importazione. L’AI analizzerà il file completo insieme alla tua segnalazione tramite OpenRouter, senza conservazione presso il fornitore.")}</p>
      <label className="flex items-start gap-2"><input type="checkbox" required checked={consent} onChange={e => setConsent(e.target.checked)} />{tr("Acconsento a inviare il file completo e la segnalazione per una nuova analisi AI.")}</label>
      <Button disabled={busy || !file || !feedback.trim() || !consent} type="submit">{tr(busy ? "Invio…" : "Analizza la correzione")}</Button>
      <Button type="button" variant="ghost" disabled={busy} onClick={() => onSelect(job.id)}>{tr("Annulla")}</Button>
    </form> : <>
      {job.status === "queued" || job.status === "processing" ? <p role="status">{tr("Nuova analisi in corso. Ti avviseremo via email quando potrai controllarla.")}</p> : null}
      {job.error ? <p role="alert">{job.error}</p> : null}
      {job.status === "expired" ? <p>{tr("La correzione è scaduta. Scartala e ricarica il file dall’importazione originale.")}</p> : null}
      {comparison.isFetching ? <p role="status">{tr("Caricamento del confronto…")}</p> : null}
      {comparison.error ? <p role="alert">{comparison.error.message}</p> : null}
      {data ? <>
        <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="text-left font-medium">{tr("Effetto dell’importazione sul conto")}</caption><thead><tr><th></th><th>{tr("Attuale")}</th><th>{tr("Proposto")}</th></tr></thead><tbody>
          <tr><th>{tr("Movimenti")}</th><td>{data.before.length}</td><td>{data.after.length}</td></tr>
          <tr><th>{tr("Operazioni di investimento")}</th><td>{data.investmentsBefore}</td><td>{data.investmentsAfter}</td></tr>
          <tr><th>{tr("Variazione di liquidità")}</th><td>{money(data.before.reduce((s, r) => s + r.amount, 0))}</td><td>{money(data.after.reduce((s, r) => s + r.amount, 0))}</td></tr>
        </tbody></table></div>
        {([ [tr("Movimenti attuali"), data.before], [tr("Movimenti proposti"), data.after] ] as const).map(([title, rows]) => <details key={title}><summary className="cursor-pointer font-medium">{title}</summary><ul className="max-h-80 overflow-auto text-sm">{rows.map((r, i) => <li key={i} className="border-b py-2">{r.date} · {r.description} · {money(r.amount)}</li>)}</ul></details>)}
        {([ [tr("Investimenti attuali"), data.tradesBefore], [tr("Investimenti proposti"), data.after.flatMap(r => r.investment ? [{ date: r.date, description: r.description, ...r.investment }] : [])] ] as const).map(([title, rows]) => <details key={title}><summary className="cursor-pointer font-medium">{title}</summary><p className="text-xs">{tr("Prezzo e lordo nella valuta dello strumento; commissioni e imposte nella valuta del profilo.")}</p><div className="max-h-80 overflow-auto"><table className="w-full text-sm"><thead><tr>{["Data", "Strumento", "Operazione", "Quantità", "Prezzo", "Lordo", "Commissioni", "Imposte"].map(label => <th key={label} className="p-2">{tr(label)}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}><td className="p-2">{r.date}</td><td>{r.description}</td><td>{tr(r.type)}</td><td>{r.quantity.toLocaleString(locale, { maximumFractionDigits: 10 })}</td><td>{r.price.toLocaleString(locale, { maximumFractionDigits: 8 })} {r.currency}</td><td>{r.grossAmount === null ? "—" : `${r.grossAmount.toLocaleString(locale)} ${r.currency}`}</td><td>{money(r.fees)}</td><td>{money(r.taxes)}</td></tr>)}</tbody></table></div></details>)}
        <label className="flex items-start gap-2"><input type="checkbox" checked={approved} onChange={e => setApproved(e.target.checked)} />{tr("Ho controllato il confronto e voglio sostituire i dati dell’importazione originale.")}</label>
        <Button disabled={busy || !approved} onClick={() => void act("replace")}>{tr("Conferma e sostituisci")}</Button>
      </> : null}
      <Button variant="outline" disabled={busy} onClick={() => void act("discard")}>{tr("Scarta correzione e mantieni originale")}</Button>
    </>}
    {error ? <p role="alert" className="text-destructive">{error}</p> : null}
  </section>;
}
