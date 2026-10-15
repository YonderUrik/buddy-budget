"use client";


import { useLocalization } from "@/lib/localization/provider";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileSpreadsheet } from "lucide-react";
import { BackLink } from "@/components/domain/shared";
import {
  PersonalImportCorrection,
  PersonalImportList,
  PersonalImportReceipt,
  PersonalImportReview,
  isActiveJob,
  type PersonalImportReceiptFile,
  PersonalImportUpload,
} from "@/components/domain/personal-import";
import { usePersonalImportsQuery } from "@/lib/queries/personal-imports";

const LIST_ID = "le-tue-importazioni";
const PAGE_TITLE = "Importa da CSV o Excel";

/** Import di un estratto conto o di un rendiconto non ancora supportato: l'AI ricava il formato, che resta dell'utente. */
function PersonalImports() {
  const { locale: formattingLocale } = useLocalization();

  const { t: tr } = useLocalization();
  const params = useSearchParams();
  const [selected, setSelected] = useState<string | null>(params.get("job"));
  const [correcting, setCorrecting] = useState<string | null>(null);
  const listing = usePersonalImportsQuery();
  // File appena inviato: sostituisce il modulo con «File ricevuto» finché non se ne carica un altro.
  const [receipt, setReceipt] = useState<{ jobId: string; file: PersonalImportReceiptFile } | null>(null);
  const jobs = listing.data?.jobs;
  const selectedJob = jobs?.find((j) => j.id === selected) ?? (selected ? undefined : jobs?.find(isActiveJob));

  // Rapporto del file: quello appena inviato, oppure quello scelto dall'isola o dalla lista.
  const reportJob = receipt ? jobs?.find((j) => j.id === receipt.jobId) ?? ({ id: receipt.jobId } as NonNullable<typeof jobs>[number]) : selectedJob;
  const reportFile: PersonalImportReceiptFile = receipt?.file ?? { name: tr("Importazione del {0}", { 0: reportJob?.createdAt ? new Date(reportJob.createdAt).toLocaleDateString(formattingLocale, { day: "numeric", month: "long" }) : "" }).trim(), source: listing.data?.formats.find((f) => f.id === reportJob?.formatId)?.name ?? "File" };
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-4 sm:p-6">
      <header className="flex flex-col gap-2">
        <BackLink href="/liquidita" label={tr("Liquidità")} />
        <h1 className="flex items-center gap-2 font-heading text-3xl font-medium tracking-tight sm:text-4xl">
          <FileSpreadsheet className="size-7 text-muted-foreground" aria-hidden="true" />
          {tr(PAGE_TITLE)}
        </h1>
        <p className="text-text-2">{tr("Per le banche e i broker che BuddyBudget non supporta ancora. L'AI riconosce le colonne e il formato resta tuo: lo riusi ai file successivi senza altre analisi.")}</p>
      </header>

      {reportJob && (correcting === reportJob.id || (reportJob.correctionOf && reportJob.status !== "imported")) ? (
        <PersonalImportCorrection key={reportJob.id} job={reportJob} onSelect={id => { setCorrecting(null); setReceipt(null); setSelected(id); }} />
      ) : reportJob?.status === "review_failed" ? (
        <PersonalImportReview
          key={reportJob.id}
          job={reportJob}
          file={reportFile}
          listId={LIST_ID}
          onUploadCorrected={() => { setReceipt(null); setSelected(null); requestAnimationFrame(() => document.getElementById("nuovo-import")?.scrollIntoView({ behavior: "smooth", block: "start" })); }}
          onReanalyzed={(jobId) => { setSelected(jobId); setReceipt({ jobId, file: reportFile }); }}
        />
      ) : reportJob ? (
        <PersonalImportReceipt key={reportJob.id} file={reportFile} job={receipt ? jobs?.find((j) => j.id === receipt.jobId) : reportJob} listId={LIST_ID} onCorrect={() => setCorrecting(reportJob.id)} onAnother={() => { setReceipt(null); setSelected(null); }} />
      ) : null}

      {receipt || correcting || (reportJob?.correctionOf && reportJob.status !== "imported") ? null : <div id="nuovo-import" className="scroll-mt-6"><PersonalImportUpload formats={listing.data?.formats ?? []} onQueued={(jobId, file) => { setSelected(jobId); setReceipt({ jobId, file }); }} /></div>}
      <div id={LIST_ID} className="scroll-mt-6"><PersonalImportList onRetry={() => { setReceipt(null); setSelected(null); requestAnimationFrame(() => document.getElementById("nuovo-import")?.scrollIntoView({ behavior: "smooth", block: "start" })); }} listing={listing} selectedId={selectedJob?.id ?? selected} onSelect={id => { setReceipt(null); setCorrecting(null); setSelected(id); }} /></div>
    </main>
  );
}

export default function Page() {
  const { t: tr } = useLocalization();
  return (
    <Suspense fallback={<p role="status" className="p-6">{tr("Caricamento…")}</p>}>
      <PersonalImports />
    </Suspense>
  );
}
