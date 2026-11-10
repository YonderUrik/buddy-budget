"use client";

/**
 * «Altre banche · In arrivo»: the last entry of the bank list while new GoCardless connections are closed (or out of
 * slots), as a dashed card under the banks that work today. «Tienimi aggiornato» records the request (and can be
 * withdrawn), so we know how many people want it.
 */

import { BellIcon, CheckIcon, Loader2Icon, ZapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocalization } from "@/lib/localization/provider";
import { useBankInterestMutation } from "@/lib/queries/gocardless";
import { errorToast } from "@/lib/support/request-report";

export interface BankComingSoonProps {
  /** The person already asked to be told: shows the confirmation instead of the button. */
  interested: boolean;
  /** Hides the button (a self-hosted install has nobody to write to it, other reasons are not a waiting list). */
  canRequest?: boolean;
  badge?: string;
  detail?: string;
}

export function BankComingSoon({ interested, canRequest = true, badge = "In arrivo", detail = "Intesa, UniCredit, Fineco, N26 e le altre banche europee, con saldi e movimenti che arrivano da soli." }: BankComingSoonProps) {
  const { t: tr } = useLocalization();
  const interest = useBankInterestMutation();
  const save = (value: boolean) => interest.mutate(value, { onError: (error) => errorToast(error.message) });
  return (
    <div className="flex w-full flex-col gap-3 rounded-xl border border-dashed p-3.5">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-text-3 opacity-70" aria-hidden="true">
          <ZapIcon className="size-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-text-3">
            {tr("Altre banche")}
            <span className="rounded-full border border-dashed px-2 py-0.5 text-xs font-medium text-muted-foreground">{tr(badge)}</span>
          </span>
          <span className="text-sm text-text-3">{tr(detail)}</span>
        </span>
      </div>
      {!canRequest ? null : interested ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-[3.25rem] text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CheckIcon className="size-4 text-pos" aria-hidden="true" />
            {tr("Ti scriviamo quando è pronto.")}
          </span>
          <button type="button" className="min-h-11 cursor-pointer text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-50 sm:min-h-0" onClick={() => save(false)} disabled={interest.isPending}>
            {tr("Non avvisarmi più")}
          </button>
        </p>
      ) : (
        <div className="pl-[3.25rem]">
          <Button type="button" variant="outline" size="sm" className="h-11 gap-1.5 px-3.5 sm:h-8" onClick={() => save(true)} disabled={interest.isPending}>
            {interest.isPending ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : <BellIcon aria-hidden="true" />}
            {tr("Tienimi aggiornato")}
          </Button>
        </div>
      )}
    </div>
  );
}
