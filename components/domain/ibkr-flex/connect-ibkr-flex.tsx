"use client";
import Link from "next/link";
import { useState } from "react";
import { CheckIcon, ShieldCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocalization } from "@/lib/localization/provider";
import { ConnectIbkrFlexForm } from "./connect-ibkr-flex-form";
import { IBKR_FLEX_FACTS } from "./ibkr-flex-text";

/** Address of the Interactive Brokers connection page (status, sync, reconnect, disconnect). */
export const IBKR_FLEX_PAGE_HREF = "/connections/interactive-brokers";

export interface ConnectIbkrFlexProps {
  /** Called by «Fatto» once connected (the dialog closes); without it a link to the connection page is shown. */
  onDone?: () => void;
}

/**
 * Connect Interactive Brokers, as Trade Republic connects in «Nuovo conto»: what the connection can and cannot do,
 * the Flex Query guide and the token + Query ID form, then «collegato» while the history imports in the background.
 */
export function ConnectIbkrFlex({ onDone }: ConnectIbkrFlexProps) {
  const { t } = useLocalization();
  const [connected, setConnected] = useState(false);
  if (connected) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center" role="status">
        <span className="grid size-14 place-items-center rounded-full bg-pos-soft text-pos" aria-hidden="true"><CheckIcon className="size-7" /></span>
        <p className="text-base font-semibold text-foreground">{t("Interactive Brokers è collegato")}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{t("Importiamo operazioni, dividendi, interessi e liquidità in background: l'avanzamento resta visibile anche se chiudi.")}</p>
        {onDone ? <Button type="button" className="mt-2 h-11 w-full sm:w-auto sm:px-8" onClick={onDone}>{t("Fatto")}</Button> : null}
        <Link href={IBKR_FLEX_PAGE_HREF} className="text-sm font-medium text-primary hover:underline" onClick={onDone}>{t("Vedi lo stato del collegamento")}</Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-col gap-2.5">
        {IBKR_FLEX_FACTS.map((fact, index) => (
          <li key={fact} className="flex items-start gap-2.5 text-sm text-text-2">
            {index === 0 ? <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : <CheckIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
            {t(fact)}
          </li>
        ))}
      </ul>
      <ConnectIbkrFlexForm onConnected={() => setConnected(true)} />
    </div>
  );
}
