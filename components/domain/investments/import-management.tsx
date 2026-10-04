"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { useBrokerStatementsQuery, useDeleteStatementImportMutation } from "@/lib/queries/investments";
import { useInvestmentsActions } from "./investments-actions";

/** Review broker imports and explicitly confirm deletion of a statement and its dependent later history. */
export function ImportManagement() {
  const query = useBrokerStatementsQuery();
  const deletion = useDeleteStatementImportMutation();
  const { openImport } = useInvestmentsActions();
  const [selection, setSelection] = useState<{ id: string; ids: string[]; periods: string[] } | null>(null);
  const documents = query.data?.statements ?? [];
  function review(id: string) {
    deletion.reset();
    const selected = documents.find((d) => d.id === id)!;
    const affected = documents.filter((d) => d.portfolioId === selected.portfolioId && d.statement.from >= selected.statement.from);
    setSelection({ id, ids: affected.map((d) => d.id), periods: affected.map((d) => `${d.statement.from} – ${d.statement.to}`) });
  }
  async function confirm() {
    if (!selection) return;
    try { await deletion.mutateAsync({ id: selection.id, confirmedIds: selection.ids }); setSelection(null); }
    catch { /* Mutation error stays visible in the dialog. */ }
  }
  return <section className="flex flex-col gap-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-medium">Gestisci importazioni</h2><Button onClick={openImport}>Nuova importazione</Button></div>
    <p className="text-sm text-muted-foreground">Rendiconti Interactive Brokers. Per aggiornare un periodo, importa un nuovo CSV che copra interamente i rendiconti da sostituire: l’anteprima mostra cosa cambia. Gli altri import CSV restano gestibili dalla scheda Operazioni.</p>
    <Link className="text-sm underline" href="/investimenti/rendiconti">Vedi saldi e posizioni dei rendiconti</Link>
    {query.isLoading ? <p>Caricamento importazioni…</p> : query.isError ? <p role="alert">Impossibile caricare le importazioni. <button onClick={() => query.refetch()}>Riprova</button></p> : !documents.length ? <p>Nessun rendiconto importato.</p> : <ul className="divide-y rounded-lg border">{documents.map((d) => <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-medium">{d.statement.from} – {d.statement.to}</p><p className="text-sm text-muted-foreground">Interactive Brokers · conto …{d.statement.account.slice(-4)} · importato il {new Date(d.createdAt).toLocaleString("it-IT")}</p></div><div className="flex gap-2"><Button variant="outline" onClick={openImport}>Aggiorna CSV</Button><Button variant="destructive" onClick={() => review(d.id)} aria-label={`Elimina importazione ${d.statement.from} – ${d.statement.to}`}>Elimina</Button></div></li>)}</ul>}
    {deletion.isSuccess && !selection ? <p role="status">Importazioni eliminate. Saldi e posizioni aggiornati.</p> : null}
    <AlertDialog open={selection !== null} onOpenChange={(open) => { if (!open && !deletion.isPending) setSelection(null); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Eliminare le importazioni elencate?</AlertDialogTitle><AlertDialogDescription>Verranno eliminati i rendiconti elencati e le relative operazioni, compresi i periodi successivi che dipendono dai loro saldi. La liquidità torna all’ultima chiusura conservata, oppure a zero. Strumenti e prezzi storici restano disponibili. Puoi ripristinare lo storico importando nuovamente i CSV.</AlertDialogDescription></AlertDialogHeader>
        <ul className="max-h-48 overflow-y-auto text-sm">{selection?.periods.map((period) => <li key={period}>{period}</li>)}</ul>
        {deletion.error ? <p role="alert" className="text-sm text-destructive">{deletion.error.message}</p> : null}
        <AlertDialogFooter><AlertDialogCancel disabled={deletion.isPending}>Annulla</AlertDialogCancel><Button variant="destructive" disabled={deletion.isPending} onClick={confirm}>{deletion.isPending ? "Eliminazione…" : "Elimina le importazioni elencate"}</Button></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>;
}
