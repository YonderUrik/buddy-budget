"use client";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { useLocalization } from "@/lib/localization/provider";
import { useIbkrFlexConnections } from "@/lib/queries/ibkr-flex";
import { IBKR_FLEX_PAGE_HREF } from "./connect-ibkr-flex";


/**
 * A pointer from the file import to the automatic IBKR connection, only where connecting is open. Meant for the end of
 * a page: it appears after a request, so placed below the content it never pushes anything.
 */
export function IbkrFlexImportHint() {
  const { t } = useLocalization();
  const state = useIbkrFlexConnections();
  if (!state.data?.open) return null;
  const connected = state.data.connections.length > 0;
  return (
    <Link href={IBKR_FLEX_PAGE_HREF} className="flex items-center justify-between gap-3 rounded-2xl bg-card p-4 text-sm transition-colors hover:bg-muted/60">
      <span className="flex flex-col gap-0.5">
        <span className="font-medium text-foreground">{connected ? t("Interactive Brokers è collegato") : t("Usi Interactive Brokers? Collegalo una volta")}</span>
        <span className="text-text-2">{connected ? t("Si aggiorna da solo ogni giorno: qui vedi stato e ultima sincronizzazione.") : t("Con un token Flex i rendiconti arrivano da soli ogni giorno, senza caricare file.")}</span>
      </span>
      <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}
