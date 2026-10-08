"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, Clock3, CheckCircle2 } from "lucide-react";
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
  if (hidden) return <p className="rounded-xl border p-5">Disattiva «Nascondi gli importi» per consultare il dettaglio.</p>;
  const financial = data.records.filter(r => ["cash", "investment"].includes(r.outcome.kind));
  const ignored = data.records.filter(r => r.outcome.kind === "ignore").length;
  return <section className="space-y-4 rounded-xl border bg-card p-5" aria-label="Anteprima CSV">
    <h2 className="text-lg font-semibold">Dettaglio dell’analisi</h2>
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
  </section>;
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
  return <main className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
    <header className="space-y-2"><Link href="/liquidita" className="text-sm text-muted-foreground hover:underline">← Liquidità</Link><h1 className="flex items-center gap-2 text-2xl font-semibold"><FileSpreadsheet className="size-6" />I tuoi CSV</h1><p className="text-muted-foreground">Importa da una banca o un broker non ancora supportato. Prepariamo un formato personale che potrai riutilizzare.</p></header>
    <form className="space-y-4 rounded-xl border bg-card p-5" onSubmit={e => { e.preventDefault(); upload.mutate(); }}>
      <h2 className="font-semibold">Carica un file</h2>
      <label className="block space-y-1 text-sm"><span>Formato</span><select value={formatId} onChange={e => { setFormatId(e.target.value); setRegenerate(false); }} className="block w-full rounded-md border bg-background p-2"><option value="">Nuova banca o broker</option>{listing.data?.formats.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
      {!formatId && <label className="block space-y-1 text-sm"><span>Da dove hai ottenuto il CSV?</span><Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome della banca o del broker" maxLength={80} required /></label>}
      <label className="block space-y-1 text-sm"><span>File CSV · massimo 25 MB e 50.000 righe</span><Input type="file" accept=".csv,text/csv" required onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
      {formatId && <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={regenerate} onChange={e => setRegenerate(e.target.checked)} />Analizza di nuovo il formato (se il file è cambiato o il risultato precedente non era corretto).</label>}
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={consent} onChange={e => setConsent(e.target.checked)} required /><span>Acconsento all’analisi AI: il file originale completo sarà inviato a OpenRouter e al modello configurato, con fornitori senza conservazione dei dati. Il file può contenere descrizioni e dati finanziari; eventuali dati personali presenti nel file saranno inclusi. Il formato personale selezionato viene riutilizzato senza inviare dati all’AI.</span></label>
      <p className="text-xs text-muted-foreground">File e anteprima sono cifrati e disponibili per 7 giorni; il file originale viene eliminato al termine dell’analisi. Il formato è privato. Pagamenti e investimenti vengono salvati automaticamente al termine dei controlli.</p>
      <Button type="submit" disabled={!consent || !file || upload.isPending || (!formatId && !name.trim())}>{upload.isPending ? "Caricamento…" : "Importa CSV"}</Button>
      {upload.error && <p role="alert" className="text-sm text-destructive">{upload.error.message}</p>}
    </form>
    {selectedJob && ["queued", "processing", "ready"].includes(selectedJob.status) && <section className="space-y-2 rounded-xl border bg-primary/5 p-5" role="status"><h2 className="flex items-center gap-2 font-semibold"><Clock3 className="size-5" />{selectedJob.status === "ready" ? "Stiamo salvando le tue operazioni" : "Stiamo analizzando il tuo file"}</h2><p>Puoi chiudere questa pagina. Riceverai un’email quando avremo finito.</p><p className="text-sm text-muted-foreground">Tempo stimato: 1 ora · Completamento previsto: {new Date(selectedJob.estimatedAt).toLocaleString("it-IT")}. È una stima, non una scadenza garantita.</p>{new Date(selectedJob.estimatedAt) < new Date() && <p className="text-sm">L’analisi sta richiedendo più tempo del previsto. Ti avviseremo appena sarà pronta.</p>}</section>}
    {selectedJob?.status === "imported" && <p role="status" className="flex items-center gap-2"><CheckCircle2 className="size-5" />Importazione completata. Trovi i dati in Liquidità e Investimenti.</p>}
    {selectedJob?.status === "review_failed" && <PreviewPanel key={selectedJob.id} id={selectedJob.id} />}
    <section className="space-y-3"><h2 className="text-lg font-semibold">Le tue importazioni</h2>{listing.isPending && <p>Caricamento…</p>}{listing.error && <p role="alert">{listing.error.message}</p>}{listing.data?.jobs.length === 0 && <p className="text-sm text-muted-foreground">I file caricati e il loro stato compariranno qui.</p>}{listing.data?.jobs.map(job => <button key={job.id} onClick={() => setSelected(job.id)} className={`block w-full rounded-xl border p-4 text-left hover:bg-muted/50 ${selected === job.id ? "border-primary" : ""}`}><span className="block font-medium">{listing.data.formats.find(f => f.id === job.formatId)?.name}</span><span className="block text-sm">{labels[job.status] ?? job.status} · {new Date(job.createdAt).toLocaleString("it-IT")}</span>{job.error && job.status !== "imported" && <span className="block text-sm text-destructive">{job.error}</span>}{["ready", "review_failed"].includes(job.status) && <span className="block text-xs text-muted-foreground">Disponibile fino al {new Date(job.expiresAt).toLocaleDateString("it-IT")}</span>}</button>)}</section>
  </main>;
}
export default function Page() { return <Suspense fallback={<p className="p-6">Caricamento…</p>}><PersonalImports /></Suspense>; }
