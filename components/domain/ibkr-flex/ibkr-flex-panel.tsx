"use client";
import { Loader2Icon } from "lucide-react";
import { LoadError, SECTION_TITLE } from "@/components/domain/shared";
import { useLocalization } from "@/lib/localization/provider";
import { useIbkrFlexConnections } from "@/lib/queries/ibkr-flex";
import { ConnectIbkrFlex } from "./connect-ibkr-flex";
import { IbkrFlexConnectionCard } from "./ibkr-flex-connection-card";
import { IBKR_FLEX_ERRORS } from "./ibkr-flex-text";

/** Minimum height of the loading state, close to the form's, so the page does not jump when data arrives. */
const LOADING_MIN_HEIGHT = "min-h-96";

/**
 * Interactive Brokers through the Flex Web Service: the connected accounts with their status, and the guide and form
 * to connect one more (each IBKR account has its own Flex Query). Read-only; no username or password is ever asked.
 */
export function IbkrFlexPanel() {
  const { t } = useLocalization();
  const state = useIbkrFlexConnections();
  if (state.isPending) return <div className={`flex ${LOADING_MIN_HEIGHT} items-center justify-center`} role="status" aria-label={t("Caricamento…")}><Loader2Icon className="size-5 animate-spin text-muted-foreground" aria-hidden="true" /></div>;
  if (state.isError) return <LoadError message="Non riesco a caricare il collegamento con Interactive Brokers." onRetry={() => void state.refetch()} />;
  const { configured, connections } = state.data;
  return (
    <div className="flex flex-col gap-8">
      {connections.length ? (
        <section className="flex flex-col gap-3">
          <h2 className={SECTION_TITLE}>{t("I tuoi conti collegati")}</h2>
          {connections.map((connection) => <IbkrFlexConnectionCard key={connection.id} connection={connection} />)}
        </section>
      ) : null}
      <section className="flex flex-col gap-4">
        <h2 className={SECTION_TITLE}>{connections.length ? t("Collega un altro conto") : t("Collega il conto")}</h2>
        {configured ? <ConnectIbkrFlex /> : <p role="status" className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">{t(IBKR_FLEX_ERRORS.unavailable_here)}</p>}
      </section>
    </div>
  );
}
