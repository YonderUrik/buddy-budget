"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeftIcon, FileSpreadsheet } from "lucide-react";
import {
  PersonalImportList,
  PersonalImportPreview,
  PersonalImportReceipt,
  PersonalImportProgress,
  type PersonalImportReceiptFile,
  PersonalImportUpload,
  isActiveJob,
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

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-4 sm:p-6">
      <header className="flex flex-col gap-2">
        <Link href="/liquidita" className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-4" aria-hidden="true" /> Liquidità
        </Link>
        <h1 className="flex items-center gap-2 font-heading text-3xl font-medium tracking-tight sm:text-4xl">
          <FileSpreadsheet className="size-7 text-muted-foreground" aria-hidden="true" />
          {PAGE_TITLE}
        </h1>
        <p className="text-text-2">Per le banche e i broker che BuddyBudget non supporta ancora. L&apos;AI riconosce le colonne e il formato resta tuo: lo riusi ai file successivi senza altre analisi.</p>
      </header>

      {receipt ? (
        <PersonalImportReceipt file={receipt.file} job={jobs?.find((j) => j.id === receipt.jobId)} listId={LIST_ID} onAnother={() => { setReceipt(null); setSelected(null); }} />
      ) : (
        <>
          {selectedJob && isActiveJob(selectedJob) ? <PersonalImportProgress job={selectedJob} /> : null}
          {selectedJob?.status === "imported" ? <PersonalImportProgress job={selectedJob} /> : null}
        </>
      )}
      {selectedJob?.status === "review_failed" ? <PersonalImportPreview key={selectedJob.id} id={selectedJob.id} /> : null}

      {receipt ? null : <PersonalImportUpload formats={listing.data?.formats ?? []} onQueued={(jobId, file) => { setSelected(jobId); setReceipt({ jobId, file }); }} />}
      <div id={LIST_ID} className="scroll-mt-6"><PersonalImportList listing={listing} selectedId={selectedJob?.id ?? selected} onSelect={setSelected} /></div>
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
