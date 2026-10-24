"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * Importazioni fatte, nel dialog «Importazioni» dell'intestazione di Investimenti: un elenco chiuso di default (per broker, con
 * periodo, data e stato), con l'aggiornamento (file più recente) e l'eliminazione con conferma che elenca cosa viene tolto.
 */

import * as React from "react";
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
import { markHistoryRefreshPending } from "@/lib/queries/history-refresh-signal";

type DeletionPreview = { token: string; name: string; cashCount: number; investmentCount: number; uploads: { id: string; createdAt: string }[] };
async function personalRequest(id: string, token?: string): Promise<DeletionPreview> {
  const response = await fetch(`/api/personal-imports/${id}${token ? "" : "?deletion=1"}`, token ? { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) } : { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Operazione non riuscita");
  return data;
}

/**
 * Imports made and their management; for broker statements deleting one also removes the later uploads that depend on it.
 * `onImport` draws «Importa un file» in the page-section version (the dialog version has none).
 */
export function ImportManagement({ embedded = false, onImport }: { embedded?: boolean; onImport?: () => void } = {}) {
  const { t: tr, locale } = useLocalization();
  const query = useBrokerStatementsQuery();
  const personal = usePersonalImportsQuery();
  const client = useQueryClient();
  const [personalSelection, setPersonalSelection] = useState<{ id: string; preview: DeletionPreview } | null>(null);
  const personalDeletion = useMutation({ mutationFn: ({ id, token }: { id: string; token: string }) => personalRequest(id, token), onSuccess: result => {
    setPersonalSelection(null); void client.invalidateQueries(); markHistoryRefreshPending(); track("personal_csv_deleted", { cash: result.cashCount, investments: result.investmentCount });
  } });
  const deletionPreview = useMutation({ mutationFn: (id: string) => personalRequest(id), onSuccess: (preview, id) => { personalDeletion.reset(); setPersonalSelection({ id, preview }); } });
  const deletion = useDeleteStatementImportMutation();
  const [selection, setSelection] = useState<{ id: string; ids: string[]; items: string[] } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const documents = query.data?.statements ?? [];
  const history = buildImportHistory(documents, personal.data, locale);
  const loading = query.isLoading || personal.isPending;
  const failed = query.isError || personal.isError;

  function review(id: string) {
    deletion.reset();
    const selected = documents.find((d) => d.id === id)!;
    const affected = documents.filter((d) => d.accountKey === selected.accountKey && d.statement.from >= selected.statement.from);
    setSelection({ id, ids: affected.map((d) => d.id), items: affected.map((d) => formatImportPeriod(d.statement.from, d.statement.to, locale)) });
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
  const summary = history.length > 0 ? tr("{0} da {1} · ultimo il {2}", { 0: plural(history.length, "file caricato", "file caricati"), 1: plural(sourceCount, "origine", "origini"), 2: formatImportDate(history[0].createdAt, locale) }) : undefined;

  const Shell = embedded ? EmbeddedShell : PanelShell;
  return (
    <Shell onImport={onImport}>
      {loading ? <p role="status" className="text-sm text-muted-foreground">{tr("Caricamento importazioni…")}</p> : null}
      {query.isError ? <p role="alert" className="text-sm text-destructive">{tr("Non riesco a leggere i rendiconti.")}{" "}<button type="button" className="font-medium underline" onClick={() => query.refetch()}>{tr("Riprova")}</button></p> : null}
      {personal.isError ? <p role="alert" className="text-sm text-destructive">{tr("Non riesco a leggere i CSV personali.")}{" "}<button type="button" className="font-medium underline" onClick={() => personal.refetch()}>{tr("Riprova")}</button></p> : null}
      {!loading && !failed && history.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tr("Non hai ancora importato nessun file: con «Importa un file» carichi il rendiconto del tuo broker.")}</p>
      ) : null}
      {deletionPreview.isPending ? <p role="status" className="text-sm text-muted-foreground">{tr("Verifico cosa verrebbe eliminato…")}</p> : null}
      {deletionPreview.error ? <p role="alert" className="text-sm text-destructive">{tr(deletionPreview.error.message)}</p> : null}
      {(deletion.isSuccess && !selection) || personalDeletion.isSuccess ? <p role="status" className="text-sm text-foreground">{tr("Importazione eliminata. Saldi e posizioni sono aggiornati.")}</p> : null}

      {history.length > 0 ? (
        <Disclosure bare title={tr("Vedi e gestisci i file caricati")} summary={summary}>
          <ImportHistoryList groups={groups} busy={deletionPreview.isPending} onDelete={onDelete} />
          {history.length > VISIBLE_IMPORTS ? (
            <Button variant="ghost" size="sm" className="self-start" onClick={() => setShowAll((v) => !v)}>
              {showAll ? tr("Mostra meno") : tr("Mostra tutte ({0})", {0: history.length})}
            </Button>
          ) : null}
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{tr("Annullare un'importazione:")}</span>{" "}{tr("«Elimina» toglie le operazioni e i saldi che quel file aveva portato; ti mostro cosa sparisce prima di confermare e puoi sempre reimportare il file.")}</p>
          <details className="group">
            <summary className="min-h-11 cursor-pointer list-none content-center text-sm font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">{tr("Opzioni avanzate")}{" "}<span className="font-normal">{tr("· ripartire da zero")}</span>
            </summary>
            <div className="pt-2"><ResetInvestments /></div>
          </details>
        </Disclosure>
      ) : null}

      <ImportDeleteDialog
        open={personalSelection !== null}
        title={tr("Eliminare l'importazione «{0}»?", {0: personalSelection?.preview.name ?? ""})}
        intro="I dati caricati con questo formato personale vengono tolti dal tuo patrimonio."
        items={personalSelection?.preview.uploads.map((u) => tr("Caricamento del {0}", {0: formatImportDate(u.createdAt, locale)})) ?? []}
        removes={[
          tr("{0} movimenti di cassa (inclusi i regolamenti degli investimenti)", {0: personalSelection?.preview.cashCount ?? 0}),
          tr("{0} operazioni di investimento", {0: personalSelection?.preview.investmentCount ?? 0}),
        ]}
        keeps={["Il formato personale, i conti e gli strumenti", "Puoi reimportare il CSV quando vuoi: i saldi si aggiornano di nuovo"]}
        pending={personalDeletion.isPending}
        error={personalDeletion.error?.message}
        confirmLabel={tr("Elimina l'importazione")}
        onConfirm={() => { if (personalSelection) personalDeletion.mutate({ id: personalSelection.id, token: personalSelection.preview.token }); }}
        onCancel={() => setPersonalSelection(null)}
      />
      <ImportDeleteDialog
        open={selection !== null}
        title={selection && selection.ids.length > 1 ? tr("Eliminare {0} importazioni di {1}?", {0: selection.ids.length, 1: brokerSource ?? tr("questo conto")}) : tr("Eliminare l'importazione di {0}?", {0: brokerSource ?? tr("questo conto")})}
        intro={selection && selection.ids.length > 1 ? "Insieme a quella scelta vanno tolti i caricamenti successivi dello stesso conto, perché i loro saldi partono da questo." : "Il rendiconto e le sue operazioni vengono tolti dal portafoglio."}
        items={selection?.items ?? []}
        removes={[brokerSource?.startsWith("Trade Republic") ? "Le operazioni di questi rendiconti e i movimenti del conto importati con loro" : "Le operazioni di questi rendiconti", "La liquidità torna all'ultima chiusura conservata, o a zero"]}
        keeps={["Strumenti e prezzi storici", "Puoi ripristinare tutto importando di nuovo i file originali"]}
        pending={deletion.isPending}
        error={deletion.error?.message}
        confirmLabel={selection && selection.ids.length > 1 ? tr("Elimina {0} importazioni", {0: selection.ids.length}) : tr("Elimina l'importazione")}
        onConfirm={confirm}
        onCancel={() => setSelection(null)}
      />
    </Shell>
  );
}

/** Contenitore dentro il dialog: niente intestazione, il titolo è quello del dialog. */
function EmbeddedShell({ children }: { children: React.ReactNode; onImport?: () => void }) {
  return <div className="flex flex-col gap-4">{children}</div>;
}

/** Container as a page section, with «Importa un file» when the caller can open the import. */
function PanelShell({ children, onImport }: { children: React.ReactNode; onImport?: () => void }) {
  const { t: tr } = useLocalization();
  return (
    <PanelSection icon={DatabaseIcon} title={tr("Importazioni")} color="var(--swatch-slate)" description={IMPORT_EXPLANATION} action={onImport ? <Button variant="outline" size="sm" onClick={onImport}><UploadIcon className="size-4" aria-hidden="true" />{" "}{tr("Importa un file")}</Button> : undefined}>
      {children}
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
