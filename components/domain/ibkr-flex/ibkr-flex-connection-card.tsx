"use client";
import { useState } from "react";
import { Loader2Icon, RefreshCwIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatDateWithYear } from "@/lib/format";
import { useLocalization } from "@/lib/localization/provider";
import { useDisconnectIbkrFlex, useSyncIbkrFlex, type IbkrFlexConnectionView } from "@/lib/queries/ibkr-flex";
import { cn } from "@/lib/utils";
import { ConnectIbkrFlex } from "./connect-ibkr-flex";
import { IBKR_FLEX_ERRORS, IBKR_FLEX_STATUS } from "./ibkr-flex-text";

export interface IbkrFlexConnectionCardProps {
  connection: IbkrFlexConnectionView;
}

/** One connected IBKR account: status, period covered, last sync, error with its fix, and sync / reconnect / disconnect. */
export function IbkrFlexConnectionCard({ connection }: IbkrFlexConnectionCardProps) {
  const { t, locale } = useLocalization();
  const sync = useSyncIbkrFlex();
  const disconnect = useDisconnectIbkrFlex();
  const [reconnecting, setReconnecting] = useState(connection.status === "expired");
  const canSync = connection.status !== "expired";
  const syncError = sync.error ? IBKR_FLEX_ERRORS[sync.error.message] ?? IBKR_FLEX_ERRORS.internal : null;
  return (
    <article className="flex flex-col gap-4 rounded-2xl bg-card p-4 sm:p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">{t("Conto Interactive Brokers …{0}", { 0: connection.accountLabel })}</h2>
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", connection.status === "linked" ? "bg-pos-soft text-pos" : "bg-neg-soft text-neg")}>{t(IBKR_FLEX_STATUS[connection.status])}</span>
      </header>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div><dt className="text-text-3">{t("Dati aggiornati al")}</dt><dd className="text-foreground tabular-nums">{connection.syncedThrough ? formatDateWithYear(connection.syncedThrough, locale) : t("Non ancora importati")}</dd></div>
        <div><dt className="text-text-3">{t("Ultima sincronizzazione riuscita")}</dt><dd className="text-foreground">{connection.lastSyncedAt ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(connection.lastSyncedAt)) : t("Mai")}</dd></div>
      </dl>
      <p className="text-xs text-text-3">{t("I valori sono quelli di chiusura del rendiconto, non prezzi in tempo reale. Si aggiorna da solo una volta al giorno.")}</p>
      {connection.lastError ? (
        <div role="alert" className="flex flex-col gap-1 rounded-xl bg-neg-soft p-3 text-sm text-foreground">
          <p>{t(IBKR_FLEX_ERRORS[connection.lastError] ?? IBKR_FLEX_ERRORS.internal)}</p>
          {connection.lastErrorDetail ? <p className="text-text-2">{t(connection.lastErrorDetail)}</p> : null}
        </div>
      ) : null}
      {syncError ? <p role="alert" className="text-sm text-destructive">{t(syncError)}</p> : null}
      <div className="flex flex-wrap gap-2">
        {canSync ? (
          <Button type="button" variant="secondary" className="h-11" disabled={sync.isPending} onClick={() => sync.mutate(connection.id)}>
            {sync.isPending ? <Loader2Icon className="size-4 animate-spin" aria-hidden="true" /> : <RefreshCwIcon className="size-4" aria-hidden="true" />}
            {t("Sincronizza ora")}
          </Button>
        ) : null}
        <Button type="button" variant="ghost" className="h-11" onClick={() => setReconnecting((open) => !open)} aria-expanded={reconnecting}>{t("Ricollega con un nuovo token")}</Button>
        <AlertDialog>
          <AlertDialogTrigger className={cn(buttonVariants({ variant: "ghost" }), "h-11 text-destructive")} disabled={disconnect.isPending}>{t("Scollega")}</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("Scollegare Interactive Brokers?")}</AlertDialogTitle>
              <AlertDialogDescription>{t("Cancelliamo il token e fermiamo la sincronizzazione. Operazioni e rendiconti già importati restano: li elimini da «Gestisci importazioni» se non ti servono.")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("Annulla")}</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={() => disconnect.mutate(connection.id)}>{t("Scollega")}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {reconnecting ? <ConnectIbkrFlex initialStep={1} submitLabel="Ricollega" onConnected={() => setReconnecting(false)} /> : null}
    </article>
  );
}
