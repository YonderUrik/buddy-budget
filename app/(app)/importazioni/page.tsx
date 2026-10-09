"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, Clock3, CheckCircle2, UploadIcon, ListChecksIcon, SearchCheckIcon } from "lucide-react";
import { PanelSection } from "@/components/domain/investments";
import { Button } from "@/components/ui/button";
import { usePrivacy } from "@/components/privacy-provider";
import { Input } from "@/components/ui/input";
import { personalImportLabels as labels, usePersonalImportsQuery } from "@/lib/queries/personal-imports";
import { track } from "@/lib/analytics";
import type { Preview } from "@/lib/personal-import/confirm";

async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/personal-imports${path}`, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Operazione non riuscita. Riprova.");
  return data;
}
function PreviewPanel({ id }: { id: string }) {
  const { hidden } = usePrivacy();
  const [page, setPage] = useState(0);
  const { data, error, isPending } = useQuery({ queryKey: ["personal-import-preview", id], queryFn: () => api<Preview>(`/${id}`), staleTime: 0 });
  if (isPending) return <p role="status">Caricamento anteprima…</p>;
  if (error || !data) return <p role="alert">{error?.message ?? "Anteprima non disponibile"}</p>;
  if (hidden) return <p className="text-sm text-muted-foreground">Disattiva «Nascondi gli importi» per consultare il dettaglio.</p>;
  const financial = data.records.filter(r => ["cash", "investment"].includes(r.outcome.kind));
  const ignored = data.records.filter(r => r.outcome.kind === "ignore").length;
  return <PanelSection icon={SearchCheckIcon} title="Dettaglio dell’analisi" color="var(--swatch-amber)" className="gap-4">
    <p className="text-sm text-muted-foreground">{data.records.length} righe analizzate · {financial.length} operazioni · {ignored} escluse. Apri il dettaglio delle righe per confrontare i valori originali.</p>
    <p className="text-sm">Verranno creati un conto dedicato e, se necessario, un portafoglio. Il saldo partirà da zero: carica lo storico completo oppure correggi il saldo del conto dopo l’importazione. Gli strumenti creati avranno prezzi manuali.</p>
    <p className="text-sm text-muted-foreground">Le righe identiche già importate con questo formato verranno saltate. File con descrizioni o colonne modificate possono produrre doppioni: confrontali con lo storico. I cambi storici convertono i movimenti in {data.currency}.</p>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Riga</th><th className="p-2">Risultato</th><th className="p-2">Data</th><th className="p-2">Dettaglio</th></tr></thead><tbody>{data.records.slice(page * 50, (page + 1) * 50).map(r => {
      const o = r.outcome;
      return <tr key={r.key} className="border-b align-top"><td className="p-2">{r.line ?? o.row + 2}</td><td className="p-2">{o.kind === "cash" ? o.transfer ? "Giroconto" : "Movimento" : o.kind === "investment" ? o.type : o.kind === "ignore" ? "Esclusa" : "Errore"}</td><td className="whitespace-nowrap p-2">{"date" in o ? o.date : "—"}</td><td className="min-w-64 p-2">
        {o.kind === "cash" ? <>{o.description} · <strong>{o.amount.toLocaleString("it-IT", { style: "currency", currency: o.currency })}</strong></> : o.kind === "investment" ? <>{o.name} ({o.isin ?? "senza ISIN"}, {o.instrumentType}) · {o.quantity} × {o.price} {o.currency}{o.grossAmount !== null ? ` · Lordo ${o.grossAmount}` : ""} · Commissioni {o.fees} · Imposte {o.taxes}</> : o.reason}
        {r.rate !== null && <p className="text-xs text-muted-foreground">Cambio verso {data.currency}: {r.rate}</p>}
        <details className="mt-1 text-xs text-muted-foreground"><summary className="cursor-pointer">Riga originale</summary><dl className="mt-2 space-y-1">{r.source.map((value, i) => <div key={i}><dt className="inline font-medium">{data.headers[i] ?? `Colonna ${i + 1}`}: </dt><dd className="inline break-all">{value}</dd></div>)}</dl></details>
      </td></tr>;
    })}</tbody></table></div>
    <div className="flex items-center gap-3"><Button variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Precedenti</Button><span className="text-sm">{page + 1} / {Math.max(1, Math.ceil(data.records.length / 50))}</span><Button variant="outline" disabled={(page + 1) * 50 >= data.records.length} onClick={() => setPage(p => p + 1)}>Successive</Button></div>
  </PanelSection>;
}
function PersonalImports() {
  const params = useSearchParams();
  const [selected, setSelected] = useState<string | null>(params.get("job"));
  const [formatId, setFormatId] = useState(""), [name, setName] = useState(""), [file, setFile] = useState<File | null>(null), [consent, setConsent] = useState(false), [regenerate, setRegenerate] = useState(false);
  const client = useQueryClient();
  const listing = usePersonalImportsQuery();
  const upload = useMutation({ mutationFn: async () => {
    if (!file || file.size > 25 * 1024 * 1024) throw new Error("Scegli un CSV di massimo 25 MB");
    const source = listing.data?.formats.find(f => f.id === formatId)?.name ?? name;
    return api<{ id: string }>("", { name: source, csv: await file.text(), formatId: formatId || undefined, regenerate, consent, consentVersion: "openrouter-raw-zdr-v2" });
  }, onSuccess: result => { track("personal_csv_requested", { reuse: !!formatId }); setSelected(result.id); void client.invalidateQueries({ queryKey: ["personal-imports"] }); } });
  const selectedJob = listing.data?.jobs.find(j => j.id === selected);
  return <main className="mx-auto w-full max-w-5xl space-y-8 p-4 sm:p-6">
    <header className="space-y-2"><Link href="/liquidita" className="text-sm text-muted-foreground hover:underline">← Liquidità</Link><h1 className="flex items-center gap-2 font-heading text-2xl font-semibold"><FileSpreadsheet className="size-6 text-muted-foreground" aria-hidden="true" />I tuoi CSV</h1><p className="text-sm text-muted-foreground">Per le banche e i broker che BuddyBudget non supporta ancora. Carichi il file, lo analizziamo con l’AI e ne ricaviamo un formato personale che riusi ogni volta; quando l’analisi finisce ti avvisiamo per email e i dati compaiono in Liquidità e Investimenti.</p></header>
    <PanelSection icon={UploadIcon} title="Carica un file" className="gap-4"><form className="space-y-4" onSubmit={e => { e.preventDefault(); upload.mutate(); }}>
      <label className="block space-y-1 text-sm"><span>Formato</span><select value={formatId} onChange={e => { setFormatId(e.target.value); setRegenerate(false); }} className="block w-full rounded-md border bg-background p-2"><option value="">Nuova banca o broker</option>{listing.data?.formats.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
      {!formatId && <label className="block space-y-1 text-sm"><span>Da dove hai ottenuto il CSV?</span><Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome della banca o del broker" maxLength={80} required /></label>}
      <label className="block space-y-1 text-sm"><span>File CSV · massimo 25 MB e 50.000 righe</span><Input type="file" accept=".csv,text/csv" required onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
      {formatId && <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={regenerate} onChange={e => setRegenerate(e.target.checked)} />Analizza di nuovo il formato (se il file è cambiato o il risultato precedente non era corretto).</label>}
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={consent} onChange={e => setConsent(e.target.checked)} required /><span>Acconsento all’analisi AI: il file originale completo sarà inviato a OpenRouter e al modello configurato, con fornitori senza conservazione dei dati. Il file può contenere descrizioni e dati finanziari; eventuali dati personali presenti nel file saranno inclusi. Il formato personale selezionato viene riutilizzato senza inviare dati all’AI.</span></label>
      <p className="text-xs text-muted-foreground">File e anteprima sono cifrati e disponibili per 7 giorni; il file originale viene eliminato al termine dell’analisi. Il formato è privato. Pagamenti e investimenti vengono salvati automaticamente al termine dei controlli.</p>
      <Button type="submit" disabled={!consent || !file || upload.isPending || (!formatId && !name.trim())}>{upload.isPending ? "Caricamento…" : "Importa CSV"}</Button>
      {upload.error && <p role="alert" className="text-sm text-destructive">{upload.error.message}</p>}
    </form></PanelSection>
    {selectedJob && ["queued", "processing", "ready"].includes(selectedJob.status) && <PanelSection icon={Clock3} title={selectedJob.status === "ready" ? "Stiamo salvando le tue operazioni" : "Stiamo analizzando il tuo file"} color="var(--swatch-indigo)"><div role="status" className="space-y-2 text-sm"><p>Puoi chiudere questa pagina. Riceverai un’email quando avremo finito.</p><p className="text-sm text-muted-foreground">Tempo stimato: 1 ora · Completamento previsto: {new Date(selectedJob.estimatedAt).toLocaleString("it-IT")}. È una stima, non una scadenza garantita.</p>{new Date(selectedJob.estimatedAt) < new Date() && <p className="text-sm">L’analisi sta richiedendo più tempo del previsto. Ti avviseremo appena sarà pronta.</p>}</div></PanelSection>}
    {selectedJob?.status === "imported" && <p role="status" className="flex items-center gap-2 text-sm"><CheckCircle2 className="size-5 text-pos" aria-hidden="true" />Importazione completata. Trovi i dati in Liquidità e Investimenti.</p>}
    {selectedJob?.status === "review_failed" && <PreviewPanel key={selectedJob.id} id={selectedJob.id} />}
    <PanelSection icon={ListChecksIcon} title="Le tue importazioni" color="var(--swatch-slate)" description={listing.data?.jobs.length === 0 ? "I file caricati e il loro stato compariranno qui." : undefined}>
      {listing.isPending && <p role="status" className="text-sm text-muted-foreground">Caricamento…</p>}
      {listing.error && <p role="alert" className="text-sm text-destructive">{listing.error.message}</p>}
      {listing.data && listing.data.jobs.length > 0 && <ul className="flex flex-col divide-y">{listing.data.jobs.map(job => <li key={job.id}><button type="button" onClick={() => setSelected(job.id)} aria-current={selected === job.id} className={`flex min-h-11 w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 text-left hover:bg-muted/40 ${selected === job.id ? "font-medium" : ""}`}><span className="min-w-0"><span className="block text-sm font-medium">{listing.data.formats.find(f => f.id === job.formatId)?.name}</span><span className="block text-xs text-muted-foreground">Caricato il {new Date(job.createdAt).toLocaleString("it-IT")}{["ready", "review_failed"].includes(job.status) ? ` · disponibile fino al ${new Date(job.expiresAt).toLocaleDateString("it-IT")}` : ""}</span>{job.error && job.status !== "imported" && <span className="block text-xs text-destructive">{job.error}</span>}</span><span className="flex items-center gap-1.5 text-sm text-muted-foreground"><span className="size-2 rounded-full" style={{ backgroundColor: job.status === "imported" ? "var(--pos)" : ["failed", "review_failed"].includes(job.status) ? "var(--destructive)" : job.status === "expired" ? "var(--swatch-amber)" : "var(--swatch-indigo)" }} aria-hidden="true" />{labels[job.status] ?? job.status}</span></button></li>)}</ul>}
    </PanelSection>
  </main>;
}
export default function Page() { return <Suspense fallback={<p className="p-6">Caricamento…</p>}><PersonalImports /></Suspense>; }
