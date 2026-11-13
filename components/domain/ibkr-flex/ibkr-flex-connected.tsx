"use client";
import Link from "next/link";
import { CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocalization } from "@/lib/localization/provider";
import { useSyncJobsQuery } from "@/lib/queries/sync-jobs";
import { FINAL_PHASES } from "@/lib/sync-jobs/types";

export interface IbkrFlexConnectedProps {
  /** The history import started with the connection, when the server scheduled one. */
  jobId: string | null;
  /** Address of the connection page (status, sync, reconnect). */
  pageHref: string;
  /** Called by «Fatto»; without it only the link to the connection page is shown. */
  onDone?: () => void;
}

/** «Interactive Brokers è collegato» with the history import's real progress (statements imported of those to fetch). */
export function IbkrFlexConnected({ jobId, pageHref, onDone }: IbkrFlexConnectedProps) {
  const { t } = useLocalization();
  const jobs = useSyncJobsQuery();
  const account = jobs.data?.find((job) => job.id === jobId)?.accounts[0] ?? null;
  const total = account?.total ?? null;
  const finished = account !== null && FINAL_PHASES.has(account.phase);
  const failed = account?.phase === "error" || account?.phase === "expired";
  const share = total ? Math.min(1, account!.processed / total) : 0;
  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center" role="status">
      <span className="grid size-14 place-items-center rounded-full bg-pos-soft text-pos" aria-hidden="true"><CheckIcon className="size-7" /></span>
      <p className="text-base font-semibold text-foreground">{t("Interactive Brokers è collegato")}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{t("Importiamo operazioni, dividendi, interessi e liquidità in background: l'avanzamento resta visibile anche se chiudi.")}</p>
      {account && total ? (
        <div className="mt-1 flex w-full max-w-sm flex-col gap-1.5">
          <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${Math.round(share * 100)}%` }} />
          </div>
          <span className="text-xs text-text-3 tabular-nums">
            {failed ? t("L'import si è fermato: trovi il motivo nella pagina del collegamento.") : finished ? t("Storia importata") : t("Rendiconti importati: {0} su {1}", { 0: account.processed, 1: total })}
          </span>
        </div>
      ) : null}
      {onDone ? <Button type="button" variant="sun" className="mt-2 h-11 w-full sm:w-auto sm:px-8" onClick={onDone}>{t("Fatto")}</Button> : null}
      <Link href={pageHref} className="text-sm font-medium text-primary hover:underline" onClick={onDone}>{t("Vedi lo stato del collegamento")}</Link>
    </div>
  );
}
