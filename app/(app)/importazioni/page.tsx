"use client";


import { useLocalization } from "@/lib/localization/provider";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileSpreadsheet } from "lucide-react";
import {
  PersonalImportList,
  PersonalImportReceipt,
  isActiveJob,
  combineJobs,
  type PersonalImportReceiptFile,
  PersonalImportUpload,
} from "@/components/domain/personal-import";
import { usePersonalImportsQuery } from "@/lib/queries/personal-imports";
import { PAGE_TITLE as PAGE_TITLE_CLASS } from "@/components/domain/shared";
import { cn } from "@/lib/utils";

const LIST_ID = "le-tue-importazioni";
const PAGE_TITLE = "Importa un file";

/** The one import of the app: bank statements and broker reports, read by a built-in reader or by the AI. */
function PersonalImports() {
  const { locale: formattingLocale } = useLocalization();

  const { t: tr } = useLocalization();
  const params = useSearchParams();
  const [selected, setSelected] = useState<string | null>(params.get("job"));
  const listing = usePersonalImportsQuery();
  // File appena inviato: sostituisce il modulo con «File ricevuto» finché non se ne carica un altro.
  const [receipt, setReceipt] = useState<{ jobIds: string[]; file: PersonalImportReceiptFile } | null>(null);
  const jobs = listing.data?.jobs;
  const selectedJob = jobs?.find((j) => j.id === selected) ?? (selected ? undefined : jobs?.find(isActiveJob));

  // Rapporto del file: quello appena inviato, oppure quello scelto dall'isola o dalla lista.
  // A batch of files reads as one job: running while any file is, then the totals of the files imported.
  const batch = receipt ? combineJobs(receipt.jobIds.map((jobId) => jobs?.find((j) => j.id === jobId))) : null;
  const reportJob = receipt ? batch?.job ?? ({ id: receipt.jobIds.at(-1)! } as NonNullable<typeof jobs>[number]) : selectedJob;
  const reportFile: PersonalImportReceiptFile = receipt?.file ?? { name: tr("Importazione del {0}", { 0: reportJob?.createdAt ? new Date(reportJob.createdAt).toLocaleDateString(formattingLocale, { day: "numeric", month: "long" }) : "" }).trim(), source: listing.data?.formats.find((f) => f.id === reportJob?.formatId)?.name ?? "File" };
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-4 sm:p-6">
      <header className="flex flex-col gap-2">
        <h1 className={cn("flex items-center gap-2", PAGE_TITLE_CLASS)}>
          <FileSpreadsheet className="size-7 text-muted-foreground" aria-hidden="true" />
          {tr(PAGE_TITLE)}
        </h1>
        <p className="text-text-2">{tr("Estratti conto della banca e rendiconti del broker, in CSV o Excel. Interactive Brokers, DEGIRO, Trade Republic, Fineco e Yahoo li leggiamo con i nostri lettori, senza AI; per gli altri formati l'AI riconosce le colonne una volta e il formato resta tuo per i file successivi.")}</p>
      </header>

      {reportJob ? (
        <PersonalImportReceipt key={receipt ? receipt.jobIds.join() : reportJob.id} file={reportFile} job={receipt ? batch?.job : reportJob} failedFiles={batch?.failedFiles ?? 0} listId={LIST_ID} onAnother={() => { setReceipt(null); setSelected(null); }} />
      ) : null}

      {receipt ? null : <div id="nuovo-import" className="scroll-mt-6"><PersonalImportUpload formats={listing.data?.formats ?? []} onQueued={(jobIds, file) => { setSelected(jobIds.at(-1)!); setReceipt({ jobIds, file }); }} /></div>}
      <div id={LIST_ID} className="scroll-mt-6"><PersonalImportList onRetry={() => { setReceipt(null); setSelected(null); requestAnimationFrame(() => document.getElementById("nuovo-import")?.scrollIntoView({ behavior: "smooth", block: "start" })); }} listing={listing} selectedId={selectedJob?.id ?? selected} onSelect={setSelected} /></div>
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
