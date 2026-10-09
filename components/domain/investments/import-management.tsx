"use client";

/**
 * Importazioni fatte, nella scheda Operazioni: cosa è stato caricato (per broker, con periodo, data e stato), come
 * aggiornarlo (importando un file più recente) e come eliminarlo con una conferma che elenca cosa viene tolto.
 */

import { useState } from "react";
import { DatabaseIcon, UploadIcon } from "lucide-react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { track } from "@/lib/analytics";
import { usePersonalImportsQuery } from "@/lib/queries/personal-imports";
import { Button } from "@/components/ui/button";
import { useBrokerStatementsQuery, useDeleteStatementImportMutation } from "@/lib/queries/investments";
import { ImportDeleteDialog } from "./import-delete-dialog";
import { buildImportHistory, formatImportDate, formatImportPeriod, groupImports } from "./import-history";
import { ImportHistoryList } from "./import-history-list";
import { ResetInvestments } from "./reset-investments";
import { PanelSection } from "./panel-section";
import { useInvestmentsActions } from "./investments-actions";

type DeletionPreview = { token: string; name: string; cashCount: number; investmentCount: number; uploads: { id: string; createdAt: string }[] };
async function personalRequest(id: string, token?: string): Promise<DeletionPreview> {
  const response = await fetch(`/api/personal-imports/${id}${token ? "" : "?deletion=1"}`, token ? { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) } : { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Operazione non riuscita");
  return data;
}

/** Importazioni fatte e loro gestione; per i rendiconti dei broker l'eliminazione include i caricamenti successivi che ne dipendono. */
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
  const [selection, setSelection] = useState<{ id: string; ids: string[]; items: string[] } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const documents = query.data?.statements ?? [];
  const history = buildImportHistory(documents, personal.data);
  const loading = query.isLoading || personal.isPending;
  const failed = query.isError || personal.isError;

  function review(id: string) {
    deletion.reset();
    const selected = documents.find((d) => d.id === id)!;
    const affected = documents.filter((d) => d.accountKey === selected.accountKey && d.statement.from >= selected.statement.from);
    setSelection({ id, ids: affected.map((d) => d.id), items: affected.map((d) => formatImportPeriod(d.statement.from, d.statement.to)) });
  }
  async function confirm() {
    if (!selection) return;
    try { await deletion.mutateAsync({ id: selection.id, confirmedIds: selection.ids }); setSelection(null); }
    catch { /* Mutation error stays visible in the dialog. */ }
  }
  function onDelete(kind: "broker" | "personal", id: string) {
    if (kind === "personal") deletionPreview.mutate(id);
    else review(id);
  }

  const groups = groupImports(showAll ? history : history.slice(0, VISIBLE_IMPORTS));
  const brokerSource = selection ? history.find((h) => h.id === selection.id)?.source : null;
  const description = loading ? "Caricamento…" : history.length > 0 ? `${history.length === 1 ? "1 importazione" : `${history.length} importazioni`} · ultima il ${formatImportDate(history[0].createdAt)}` : undefined;

  return (
    <PanelSection
      icon={DatabaseIcon}
      title="Importazioni"
      color="var(--swatch-slate)"
      description={description}
      action={<Button onClick={openImport}><UploadIcon className="size-4" aria-hidden="true" /> Importa un file</Button>}
    >
      {loading ? <p role="status" className="text-sm text-muted-foreground">Caricamento importazioni…</p> : null}
      {query.isError ? <p role="alert" className="text-sm text-destructive">Non riesco a leggere i rendiconti. <button type="button" className="font-medium underline" onClick={() => query.refetch()}>Riprova</button></p> : null}
      {personal.isError ? <p role="alert" className="text-sm text-destructive">Non riesco a leggere i CSV personali. <button type="button" className="font-medium underline" onClick={() => personal.refetch()}>Riprova</button></p> : null}
      {!loading && !failed && history.length === 0 ? (
        <p className="text-sm text-muted-foreground">Non hai ancora importato nessun file. Con «Importa un file» carichi il rendiconto del tuo broker; per un CSV tutto tuo c&apos;è{" "}
          <Link href="/importazioni" className="font-medium text-primary hover:underline">il formato personale</Link>.
        </p>
      ) : null}
      {history.length > 0 ? (
        <>
          <ImportHistoryList groups={groups} busy={deletionPreview.isPending} onDelete={onDelete} />
          {history.length > VISIBLE_IMPORTS ? (
            <Button variant="ghost" size="sm" className="self-start" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Mostra meno" : `Mostra tutte (${history.length})`}
            </Button>
          ) : null}
          <p className="text-sm text-muted-foreground">
            Per aggiornare un periodo importa un file più recente: sostituisce i rendiconti che si sovrappongono e salta le operazioni già presenti.{" "}
            <Link href="/importazioni" className="font-medium text-primary hover:underline">Carica un CSV personale →</Link>
          </p>
        </>
      ) : null}
      {deletionPreview.isPending ? <p role="status" className="text-sm text-muted-foreground">Verifico cosa verrebbe eliminato…</p> : null}
      {deletionPreview.error ? <p role="alert" className="text-sm text-destructive">{deletionPreview.error.message}</p> : null}
      {(deletion.isSuccess && !selection) || personalDeletion.isSuccess ? <p role="status" className="text-sm text-foreground">Importazione eliminata. Saldi e posizioni sono aggiornati.</p> : null}

      <details className="group">
        <summary className="min-h-11 cursor-pointer list-none content-center text-sm font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
          Opzioni avanzate <span className="font-normal">· ripartire da zero</span>
        </summary>
        <div className="pt-2"><ResetInvestments /></div>
      </details>

      <ImportDeleteDialog
        open={personalSelection !== null}
        title={`Eliminare l'importazione «${personalSelection?.preview.name ?? ""}»?`}
        intro="I dati caricati con questo formato personale vengono tolti dal tuo patrimonio."
        items={personalSelection?.preview.uploads.map((u) => `Caricamento del ${formatImportDate(u.createdAt)}`) ?? []}
        removes={[
          `${personalSelection?.preview.cashCount ?? 0} movimenti di cassa (inclusi i regolamenti degli investimenti)`,
          `${personalSelection?.preview.investmentCount ?? 0} operazioni di investimento`,
        ]}
        keeps={["Il formato personale, i conti e gli strumenti", "Puoi reimportare il CSV quando vuoi: i saldi si aggiornano di nuovo"]}
        pending={personalDeletion.isPending}
        error={personalDeletion.error?.message}
        confirmLabel="Elimina l'importazione"
        onConfirm={() => { if (personalSelection) personalDeletion.mutate({ id: personalSelection.id, token: personalSelection.preview.token }); }}
        onCancel={() => setPersonalSelection(null)}
      />
      <ImportDeleteDialog
        open={selection !== null}
        title={selection && selection.ids.length > 1 ? `Eliminare ${selection.ids.length} importazioni di ${brokerSource ?? "questo conto"}?` : `Eliminare l'importazione di ${brokerSource ?? "questo conto"}?`}
        intro={selection && selection.ids.length > 1 ? "Insieme a quella scelta vanno tolti i caricamenti successivi dello stesso conto, perché i loro saldi partono da questo." : "Il rendiconto e le sue operazioni vengono tolti dal portafoglio."}
        items={selection?.items ?? []}
        removes={[brokerSource?.startsWith("Trade Republic") ? "Le operazioni di questi rendiconti e i movimenti del conto importati con loro" : "Le operazioni di questi rendiconti", "La liquidità torna all'ultima chiusura conservata, o a zero"]}
        keeps={["Strumenti e prezzi storici", "Puoi ripristinare tutto importando di nuovo i file originali"]}
        pending={deletion.isPending}
        error={deletion.error?.message}
        confirmLabel={selection && selection.ids.length > 1 ? `Elimina ${selection.ids.length} importazioni` : "Elimina l'importazione"}
        onConfirm={confirm}
        onCancel={() => setSelection(null)}
      />
    </PanelSection>
  );
}

/** Importazioni mostrate prima di «Mostra tutte». */
const VISIBLE_IMPORTS = 6;
