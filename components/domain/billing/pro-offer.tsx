"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/domain/shared";
import { PRO_PRICE_CENTS, PRO_TRIAL_DAYS, formatProPrice, yearlySavingPercent } from "@/lib/billing";
import type { BillingInterval } from "@/lib/db/schema/billing";
import { useLocalization } from "@/lib/localization/provider";

export interface ProOfferProps {
  trialAvailable: boolean;
  pending: boolean;
  error?: string | null;
  onStart: (interval: BillingInterval) => void;
  defaultInterval?: BillingInterval;
}

/** Monthly or yearly choice with the price and the button that opens Stripe Checkout (with the 14 free days when they apply). */
export function ProOffer({ trialAvailable, pending, error, onStart, defaultInterval = "year" }: ProOfferProps) {
  const { t: tr, locale } = useLocalization();
  const [interval, setInterval] = React.useState<BillingInterval>(defaultInterval);
  const saving = yearlySavingPercent();
  const price = formatProPrice(PRO_PRICE_CENTS[interval], locale);
  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-card p-5">
      <SegmentedControl
        ariaLabel={tr("Ogni quanto pagare")}
        value={interval}
        onChange={setInterval}
        stretch
        options={[
          { value: "month", label: tr("Ogni mese") },
          { value: "year", label: tr("Ogni anno (−{0}%)", { 0: saving }) },
        ]}
      />
      <p className="flex items-baseline gap-2">
        <span className="font-heading text-4xl font-bold tabular-nums">{price}</span>
        <span className="text-sm text-text-2">{interval === "year" ? tr("all'anno") : tr("al mese")}</span>
      </p>
      <Button type="button" variant="sun" size="lg" className="h-11 w-full rounded-full text-base sm:w-fit sm:px-6" disabled={pending} onClick={() => onStart(interval)}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        {trialAvailable ? tr("Prova {0} giorni gratis", { 0: PRO_TRIAL_DAYS }) : tr("Passa a Pro")}
      </Button>
      <p className="text-xs text-text-2">
        {trialAvailable
          ? tr("Ti chiediamo la carta, ma per {0} giorni non paghi nulla. Ti avvisiamo prima del primo addebito e puoi annullare quando vuoi.", { 0: PRO_TRIAL_DAYS })
          : tr("Si rinnova da solo e puoi annullare quando vuoi: resta attivo fino alla fine del periodo pagato.")}
      </p>
      {error ? <p role="alert" className="text-sm text-neg">{error}</p> : null}
    </section>
  );
}
