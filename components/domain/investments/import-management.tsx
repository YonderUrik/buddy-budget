"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { track } from "@/lib/analytics";
import { personalImportLabels, usePersonalImportsQuery } from "@/lib/queries/personal-imports";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { useBrokerStatementsQuery, useDeleteStatementImportMutation } from "@/lib/queries/investments";
import { ResetInvestments } from "./reset-investments";
import { useInvestmentsActions } from "./investments-actions";

type DeletionPreview = { token: string; name: string; cashCount: number; investmentCount: number; uploads: { id: string; createdAt: string }[] };
async function personalRequest(id: string, token?: string): Promise<DeletionPreview> {
  const response = await fetch(`/api/personal-imports/${id}${token ? "" : "?deletion=1"}`, token ? { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) } : { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Operazione non riuscita");
  return data;
}

/** Review broker imports and explicitly confirm deletion of a statement and its dependent later history. */
export function ImportManagement() {
  const query = useBrokerStatementsQuery();
  const personal = usePersonalImportsQuery();
  const client = useQueryClient();
  const [personalSelection, setPersonalSelection] = useState<{ id: string; preview: DeletionPreview } | null>(null);
  const personalDeletion = useMutation({ mutationFn: ({ id, token }: { id: string; token: string }) => personalRequest(id, token), onSuccess: result => {
    setPersonalSelection(null); void client.invalidateQueries(); track("personal_csv_deleted", { cash: result.cashCount, investments: result.investmentCount });
  } });
  const deletionPreview = useMutation({ mutationFn: (id: string) => personalRequest(id), onSuccess: (preview, id) => { personalDeletion.reset(); setPersonalSelection({ id, preview }); } });
  const deletion = useDeleteStatementImportMutation();
  const { openImport } = useInvestmentsActions();
  const [selection, setSelection] = useState<{ id: string; ids: string[]; periods: string[] } | null>(null);
  const documents = query.data?.statements ?? [];
  const imports = [
    ...documents.map(document => ({ kind: "broker" as const, id: document.id, createdAt: document.createdAt, document })),
    ...(personal.data?.jobs ?? []).map(job => ({ kind: "personal" as const, id: job.id, createdAt: job.createdAt, job })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const sourceNames = new Map(personal.data?.formats.map(format => [format.id, format.name]) ?? []);
  function review(id: string) {
    deletion.reset();
    const selected = documents.find((d) => d.id === id)!;
    const affected = documents.filter((d) => d.accountKey === selected.accountKey && d.statement.from >= selected.statement.from);
    setSelection({ id, ids: affected.map((d) => d.id), periods: affected.map((d) => `${d.statement.from} – ${d.statement.to}`) });
  }
  async function confirm() {
    if (!selection) return;
    try { await deletion.mutateAsync({ id: selection.id, confirmedIds: selection.ids }); setSelection(null); }
    catch { /* Mutation error stays visible in the dialog. */ }
  }
  return <details className="rounded-lg border p-4">
    <summary className="cursor-pointer font-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">Gestisci importazioni</summary>
    <div className="mt-4 flex flex-col gap-4">
    <div className="flex flex-wrap items-center gap-3"><Button onClick={openImport}>Nuova importazione</Button><Link href="/importazioni" className="text-sm font-medium text-primary hover:underline">Carica un CSV personale →</Link></div>
    <p className="text-sm text-muted-foreground">Tutti i caricamenti, dal più recente: rendiconti dei broker e CSV personali. Prima di eliminare, controlla le operazioni e gli eventuali altri caricamenti interessati nella conferma.</p>
    {(query.isLoading || personal.isPending) && <p role="status">Caricamento importazioni…</p>}
    {query.isError && <p role="alert">Impossibile caricare i rendiconti. <button onClick={() => query.refetch()}>Riprova</button></p>}
    {personal.isError && <p role="alert">Impossibile caricare i CSV personali. <button onClick={() => personal.refetch()}>Riprova</button></p>}
    {!query.isLoading && !personal.isPending && !query.isError && !personal.isError && !imports.length && <p>Nessuna importazione.</p>}
    {!!imports.length && <ul className="divide-y rounded-lg border" aria-label="Tutte le importazioni">{imports.map(item => {
      const name = item.kind === "personal" ? sourceNames.get(item.job.formatId) ?? "CSV personale" : item.document.statement.provider === "trade-republic" ? "Trade Republic" : item.document.statement.provider === "degiro" ? "DEGIRO" : `Interactive Brokers · conto …${item.document.statement.account.slice(-4)}`;
      const date = new Date(item.createdAt).toLocaleString("it-IT");
      return <li key={`${item.kind}:${item.id}`} className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div><p className="font-medium">{name}</p><p className="text-sm text-muted-foreground">{item.kind === "personal" ? `CSV personale · ${personalImportLabels[item.job.status] ?? item.job.status}` : `${item.document.statement.from} – ${item.document.statement.to}`} · caricato il {date}</p></div>
        <div className="flex items-center gap-2">
          {item.kind === "personal" ? <Link href={`/importazioni?job=${item.id}`} className="text-sm font-medium text-primary hover:underline" aria-label={`Apri importazione ${name} del ${date}`}>Apri importazione →</Link> : <Button variant="outline" onClick={openImport}>Aggiorna CSV</Button>}
          <Button variant="destructive" disabled={deletionPreview.isPending} onClick={() => item.kind === "personal" ? deletionPreview.mutate(item.id) : review(item.id)} aria-label={`Elimina importazione ${name} del ${date}`}>Elimina</Button>
        </div>
      </li>;
    })}</ul>}
    {deletionPreview.isPending && <p role="status">Verifica dei dati da eliminare…</p>}
    {deletionPreview.error && <p role="alert" className="text-sm text-destructive">{deletionPreview.error.message}</p>}
    {(deletion.isSuccess && !selection || personalDeletion.isSuccess) && <p role="status">Importazioni eliminate. Saldi e posizioni aggiornati.</p>}
    <AlertDialog open={personalSelection !== null} onOpenChange={open => { if (!open && !personalDeletion.isPending) setPersonalSelection(null); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Eliminare l’importazione {personalSelection?.preview.name}?</AlertDialogTitle><AlertDialogDescription>
        Verranno rimossi {personalSelection?.preview.cashCount} movimenti di cassa (inclusi i regolamenti degli investimenti) e {personalSelection?.preview.investmentCount} operazioni di investimento. I saldi saranno aggiornati. Il formato personale, i conti e gli strumenti restano disponibili; potrai reimportare il CSV.
      </AlertDialogDescription></AlertDialogHeader>
        <ul className="max-h-48 overflow-y-auto text-sm">{personalSelection?.preview.uploads.map(upload => <li key={upload.id}>Caricamento del {new Date(upload.createdAt).toLocaleString("it-IT")}</li>)}</ul>
        {personalDeletion.error && <p role="alert" className="text-sm text-destructive">{personalDeletion.error.message}</p>}
        <AlertDialogFooter><AlertDialogCancel disabled={personalDeletion.isPending}>Annulla</AlertDialogCancel><Button variant="destructive" disabled={personalDeletion.isPending} onClick={() => { if (personalSelection) personalDeletion.mutate({ id: personalSelection.id, token: personalSelection.preview.token }); }}>{personalDeletion.isPending ? "Eliminazione…" : "Elimina i dati elencati"}</Button></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <ResetInvestments />
    <AlertDialog open={selection !== null} onOpenChange={(open) => { if (!open && !deletion.isPending) setSelection(null); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Eliminare le importazioni elencate?</AlertDialogTitle><AlertDialogDescription>Verranno eliminati i rendiconti elencati e le relative operazioni, inclusi i movimenti del conto Trade Republic, compresi i periodi successivi che dipendono dai loro saldi. La liquidità torna all’ultima chiusura conservata, oppure a zero. Strumenti e prezzi storici restano disponibili. Puoi ripristinare lo storico importando nuovamente i CSV.</AlertDialogDescription></AlertDialogHeader>
        <ul className="max-h-48 overflow-y-auto text-sm">{selection?.periods.map((period) => <li key={period}>{period}</li>)}</ul>
        {deletion.error ? <p role="alert" className="text-sm text-destructive">{deletion.error.message}</p> : null}
        <AlertDialogFooter><AlertDialogCancel disabled={deletion.isPending}>Annulla</AlertDialogCancel><Button variant="destructive" disabled={deletion.isPending} onClick={confirm}>{deletion.isPending ? "Eliminazione…" : "Elimina le importazioni elencate"}</Button></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </div>
  </details>;
}
