"use client";

/**
 * «Collega la tua banca» while new bank connections are closed: the choice stays visible with «In arrivo» and a
 * «Tienimi aggiornato» button that records the request (and can be withdrawn), so we know how many people want it.
 */

import { CheckIcon, Loader2Icon, ZapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocalization } from "@/lib/localization/provider";
import { useBankInterestMutation } from "@/lib/queries/gocardless";
import { errorToast } from "@/lib/support/request-report";

export interface BankComingSoonProps {
  /** The person already asked to be told: shows the confirmation instead of the button. */
  interested: boolean;
  /** Hides the button (a self-hosted install has nobody to write to it). */
  canRequest?: boolean;
}

export function BankComingSoon({ interested, canRequest = true }: BankComingSoonProps) {
  const { t: tr } = useLocalization();
  const interest = useBankInterestMutation();
  const save = (value: boolean) =>
    interest.mutate(value, { onError: (error) => errorToast(error.message) });
  return (
    <div className="flex w-full flex-col gap-3 rounded-xl border bg-muted/30 p-3.5">
      <div className="flex items-center gap-3.5">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground" aria-hidden="true">
          <ZapIcon className="size-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {tr("Collega la tua banca")}
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{tr("In arrivo")}</span>
          </span>
          <span className="text-sm text-muted-foreground">{tr("Saldi e movimenti che arrivano da soli dalla banca. Intanto usa un conto manuale o importa l'estratto conto.")}</span>
        </span>
      </div>
      {!canRequest ? null : interested ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-[3.625rem] text-sm text-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CheckIcon className="size-4 text-pos" aria-hidden="true" />
            {tr("Ti scriviamo quando è pronto.")}
          </span>
          <button type="button" className="min-h-11 cursor-pointer text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-50 sm:min-h-0" onClick={() => save(false)} disabled={interest.isPending}>
            {tr("Non avvisarmi più")}
          </button>
        </p>
      ) : (
        <div className="pl-[3.625rem]">
          <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={() => save(true)} disabled={interest.isPending}>
            {interest.isPending ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : null}
            {tr("Tienimi aggiornato")}
          </Button>
        </div>
      )}
    </div>
  );
}
