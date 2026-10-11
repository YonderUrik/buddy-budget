"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileSpreadsheet } from "lucide-react";
import { BackLink } from "@/components/domain/shared";
import {
  PersonalImportList,
  PersonalImportPreview,
  PersonalImportReceipt,
  isActiveJob,
  type PersonalImportReceiptFile,
  PersonalImportUpload,
} from "@/components/domain/personal-import";
import { usePersonalImportsQuery } from "@/lib/queries/personal-imports";

const LIST_ID = "le-tue-importazioni";
const PAGE_TITLE = "Importa da CSV o Excel";

/** Import di un estratto conto o di un rendiconto non ancora supportato: l'AI ricava il formato, che resta dell'utente. */
function PersonalImports() {
  const params = useSearchParams();
  const [selected, setSelected] = useState<string | null>(params.get("job"));
  const listing = usePersonalImportsQuery();
  // File appena inviato: sostituisce il modulo con «File ricevuto» finché non se ne carica un altro.
  const [receipt, setReceipt] = useState<{ jobId: string; file: PersonalImportReceiptFile } | null>(null);
  const jobs = listing.data?.jobs;
  const selectedJob = jobs?.find((j) => j.id === selected) ?? (selected ? undefined : jobs?.find(isActiveJob));

  // Rapporto del file: quello appena inviato, oppure quello scelto dall'isola o dalla lista.
  const reportJob = receipt ? jobs?.find((j) => j.id === receipt.jobId) ?? ({ id: receipt.jobId } as NonNullable<typeof jobs>[number]) : selectedJob;
  const reportFile: PersonalImportReceiptFile = receipt?.file ?? { name: `Importazione del ${reportJob?.createdAt ? new Date(reportJob.createdAt).toLocaleDateString("it-IT", { day: "numeric", month: "long" }) : ""}`.trim(), source: listing.data?.formats.find((f) => f.id === reportJob?.formatId)?.name ?? "File" };
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-4 sm:p-6">
      <header className="flex flex-col gap-2">
        <BackLink href="/liquidita" label="Liquidità" />
        <h1 className="flex items-center gap-2 font-heading text-3xl font-medium tracking-tight sm:text-4xl">
          <FileSpreadsheet className="size-7 text-muted-foreground" aria-hidden="true" />
          {PAGE_TITLE}
        </h1>
        <p className="text-text-2">Per le banche e i broker che BuddyBudget non supporta ancora. L&apos;AI riconosce le colonne e il formato resta tuo: lo riusi ai file successivi senza altre analisi.</p>
      </header>

      {reportJob ? <PersonalImportReceipt key={reportJob.id} file={reportFile} job={receipt ? jobs?.find((j) => j.id === receipt.jobId) : reportJob} listId={LIST_ID} onAnother={() => { setReceipt(null); setSelected(null); }} /> : null}
      {selectedJob?.status === "review_failed" ? <PersonalImportPreview key={selectedJob.id} id={selectedJob.id} /> : null}

      {receipt ? null : <div id="nuovo-import" className="scroll-mt-6"><PersonalImportUpload formats={listing.data?.formats ?? []} onQueued={(jobId, file) => { setSelected(jobId); setReceipt({ jobId, file }); }} /></div>}
      <div id={LIST_ID} className="scroll-mt-6"><PersonalImportList onRetry={() => { setReceipt(null); setSelected(null); requestAnimationFrame(() => document.getElementById("nuovo-import")?.scrollIntoView({ behavior: "smooth", block: "start" })); }} listing={listing} selectedId={selectedJob?.id ?? selected} onSelect={setSelected} /></div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p role="status" className="p-6">Caricamento…</p>}>
      <PersonalImports />
    </Suspense>
  );
}
