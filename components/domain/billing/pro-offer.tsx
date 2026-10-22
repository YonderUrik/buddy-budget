"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRO_PRICE_CENTS, PRO_TRIAL_DAYS, formatProPrice, yearlySavingPercent } from "@/lib/billing";
import type { BillingInterval } from "@/lib/db/schema/billing";
import { useLocalization } from "@/lib/localization/provider";
import { cn } from "@/lib/utils";

/** Months in a year, for the monthly equivalent of the yearly price. */
const MONTHS_PER_YEAR = 12;

export interface ProOfferProps {
  trialAvailable: boolean;
  pending: boolean;
  error?: string | null;
  onStart: (interval: BillingInterval) => void;
  defaultInterval?: BillingInterval;
}

/**
 * Inside the navy Pro card: monthly or yearly as two price tiles (yearly first, with its saving and the monthly
 * equivalent), the yellow button that opens Stripe Checkout (with the 14 free days when they apply) and what happens next.
 */
export function ProOffer({ trialAvailable, pending, error, onStart, defaultInterval = "year" }: ProOfferProps) {
  const { t: tr, locale } = useLocalization();
  const [interval, setInterval] = React.useState<BillingInterval>(defaultInterval);
  const price = (cents: number) => formatProPrice(cents, locale);
  const tiles: { value: BillingInterval; label: string; price: string; unit: string; note: string | null }[] = [
    {
      value: "year",
      label: tr("Annuale"),
      price: price(PRO_PRICE_CENTS.year),
      unit: tr("all'anno"),
      note: tr("{0} al mese", { 0: price(Math.round(PRO_PRICE_CENTS.year / MONTHS_PER_YEAR)) }),
    },
    { value: "month", label: tr("Mensile"), price: price(PRO_PRICE_CENTS.month), unit: tr("al mese"), note: null },
  ];
  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label={tr("Ogni quanto pagare")} className="grid grid-cols-2 gap-2.5">
        {tiles.map((tile) => {
          const selected = tile.value === interval;
          return (
            <button
              key={tile.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setInterval(tile.value)}
              className={cn(
                "flex min-h-24 flex-col items-start gap-1 rounded-2xl p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun sm:p-4",
                selected ? "bg-on-brand-navy/10 ring-2 ring-sun" : "ring-1 ring-on-brand-navy/20 hover:ring-on-brand-navy/40",
              )}
            >
              <span className="flex w-full items-center justify-between gap-2 text-sm text-on-brand-navy-2">
                {tile.label}
                {tile.value === "year" ? (
                  <span className="rounded-full bg-sun px-2 py-0.5 text-xs font-semibold text-on-sun">−{yearlySavingPercent()}%</span>
                ) : null}
              </span>
              <span className="flex items-baseline gap-1.5">
                <span className="font-heading text-2xl font-bold tabular-nums sm:text-3xl">{tile.price}</span>
                <span className="text-sm text-on-brand-navy-2">{tile.unit}</span>
              </span>
              {tile.note ? <span className="text-xs text-on-brand-navy-2 tabular-nums">{tile.note}</span> : null}
            </button>
          );
        })}
      </div>
      <Button type="button" variant="sun" className="h-12 w-full rounded-full text-base" disabled={pending} onClick={() => onStart(interval)}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        {trialAvailable ? tr("Prova {0} giorni gratis", { 0: PRO_TRIAL_DAYS }) : tr("Passa a Pro")}
      </Button>
      <p className="text-xs leading-relaxed text-on-brand-navy-2">
        {trialAvailable
          ? tr("Ti chiediamo la carta, ma per {0} giorni non paghi nulla. Ti avvisiamo prima del primo addebito e puoi annullare quando vuoi.", { 0: PRO_TRIAL_DAYS })
          : tr("Si rinnova da solo e puoi annullare quando vuoi: resta attivo fino alla fine del periodo pagato.")}
      </p>
      {error ? <p role="alert" className="rounded-xl bg-on-brand-navy/10 px-3 py-2 text-sm text-on-brand-navy">{error}</p> : null}
    </div>
  );
}
