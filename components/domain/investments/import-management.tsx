"use client";

/**
 * Importazioni fatte, in fondo alla scheda Operazioni: una spiegazione e un elenco chiuso di default (per broker, con
 * periodo, data e stato), con l'aggiornamento (file più recente) e l'eliminazione con conferma che elenca cosa viene tolto.
 */

import { useState } from "react";
import { DatabaseIcon, UploadIcon } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { track } from "@/lib/analytics";
import { usePersonalImportsQuery } from "@/lib/queries/personal-imports";
import { Button } from "@/components/ui/button";
import { useBrokerStatementsQuery, useDeleteStatementImportMutation } from "@/lib/queries/investments";
import { ImportDeleteDialog } from "./import-delete-dialog";
import { buildImportHistory, formatImportDate, formatImportPeriod, groupImports } from "./import-history";
import { ImportHistoryList } from "./import-history-list";
import { ResetInvestments } from "./reset-investments";
import { Disclosure } from "./disclosure";
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
  const sourceCount = new Set(history.map((h) => h.source)).size;
  const summary = history.length > 0 ? `${plural(history.length, "file caricato", "file caricati")} da ${plural(sourceCount, "origine", "origini")} · ultimo il ${formatImportDate(history[0].createdAt)}` : undefined;

  return (
    <PanelSection
      icon={DatabaseIcon}
      title="Importazioni"
      color="var(--swatch-slate)"
      description={IMPORT_EXPLANATION}
      action={<Button variant="outline" size="sm" onClick={openImport}><UploadIcon className="size-4" aria-hidden="true" /> Importa un file</Button>}
    >
      {loading ? <p role="status" className="text-sm text-muted-foreground">Caricamento importazioni…</p> : null}
      {query.isError ? <p role="alert" className="text-sm text-destructive">Non riesco a leggere i rendiconti. <button type="button" className="font-medium underline" onClick={() => query.refetch()}>Riprova</button></p> : null}
      {personal.isError ? <p role="alert" className="text-sm text-destructive">Non riesco a leggere i CSV personali. <button type="button" className="font-medium underline" onClick={() => personal.refetch()}>Riprova</button></p> : null}
      {!loading && !failed && history.length === 0 ? (
        <p className="text-sm text-muted-foreground">Non hai ancora importato nessun file: con «Importa un file» carichi il rendiconto del tuo broker.</p>
      ) : null}
      {deletionPreview.isPending ? <p role="status" className="text-sm text-muted-foreground">Verifico cosa verrebbe eliminato…</p> : null}
      {deletionPreview.error ? <p role="alert" className="text-sm text-destructive">{deletionPreview.error.message}</p> : null}
      {(deletion.isSuccess && !selection) || personalDeletion.isSuccess ? <p role="status" className="text-sm text-foreground">Importazione eliminata. Saldi e posizioni sono aggiornati.</p> : null}

      {history.length > 0 ? (
        <Disclosure bare title="Vedi e gestisci i file caricati" summary={summary}>
          <ImportHistoryList groups={groups} busy={deletionPreview.isPending} onDelete={onDelete} />
          {history.length > VISIBLE_IMPORTS ? (
            <Button variant="ghost" size="sm" className="self-start" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Mostra meno" : `Mostra tutte (${history.length})`}
            </Button>
          ) : null}
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Annullare un&apos;importazione:</span> «Elimina» toglie le operazioni e i saldi che quel file aveva portato; ti mostro cosa sparisce prima di confermare e puoi sempre reimportare il file.</p>
          <details className="group">
            <summary className="min-h-11 cursor-pointer list-none content-center text-sm font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
              Opzioni avanzate <span className="font-normal">· ripartire da zero</span>
            </summary>
            <div className="pt-2"><ResetInvestments /></div>
          </details>
        </Disclosure>
      ) : null}

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

/** Cosa sono le importazioni, sempre visibile sotto il titolo. */
const IMPORT_EXPLANATION = "I file dei broker che hai caricato. Per aggiornare un periodo importa un file più recente: sostituisce i rendiconti che si sovrappongono e salta le operazioni già presenti.";

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Importazioni mostrate prima di «Mostra tutte». */
const VISIBLE_IMPORTS = 6;
