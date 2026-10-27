"use client";

/**
 * «Altre banche · In arrivo»: the last row of the bank list while new GoCardless connections are closed (or out of
 * slots), in the same style as the banks that work today. «Avvisami» records the request (and can be withdrawn), so
 * we know how many people want it.
 */

import { CheckIcon, Loader2Icon } from "lucide-react";
import { BankRow, GenericBankLogo } from "@/components/domain/accounts";
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

export function BankComingSoon({ interested, canRequest = true, badge = "In arrivo", detail = "Intesa, UniCredit, Fineco, N26 e le altre banche europee." }: BankComingSoonProps) {
  const { t: tr } = useLocalization();
  const interest = useBankInterestMutation();
  const save = (value: boolean) => interest.mutate(value, { onError: (error) => errorToast(error.message) });
  return (
    <BankRow logo={<GenericBankLogo muted />} name={tr("Altre banche")} badge={tr(badge)} detail={tr(detail)} muted trailing={null}>
      {!canRequest ? null : interested ? (
        <span className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CheckIcon className="size-3.5 text-pos" aria-hidden="true" />
            {tr("Ti scriviamo quando è pronto.")}
          </span>
          <button type="button" className="min-h-11 cursor-pointer underline underline-offset-2 hover:text-foreground disabled:opacity-50 sm:min-h-0" onClick={() => save(false)} disabled={interest.isPending}>
            {tr("Non avvisarmi più")}
          </button>
        </span>
      ) : (
        <Button type="button" variant="outline" size="sm" className="mt-1.5 h-11 w-fit gap-1.5 bg-background px-3.5 sm:h-8" onClick={() => save(true)} disabled={interest.isPending}>
          {interest.isPending ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : null}
          {tr("Avvisami quando arrivano")}
        </Button>
      )}
    </BankRow>
  );
}
