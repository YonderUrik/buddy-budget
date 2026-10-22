"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { PRO_PRICE_CENTS, PRO_TRIAL_DAYS, formatProPrice } from "@/lib/billing";
import { isCountryPathAvailable } from "@/lib/localization/config";
import { useLocalization } from "@/lib/localization/provider";
import { cn } from "@/lib/utils";
import { useProUpsell } from "./use-pro-upsell";

export interface ProMenuCardProps {
  /** `sidebar`: under the menu items, on the navy sidebar (an icon when collapsed); `menu`: in the phone's «Altro» sheet. */
  place: "sidebar" | "menu";
  /** Collapsed sidebar: only a yellow icon. */
  collapsed?: boolean;
  /** Called when the card leads away (closes the drawer or the sheet). */
  onNavigate?: () => void;
}

/** The standing invitation to Pro in the navigation of a Free account; nothing where there is nothing to buy. */
export function ProMenuCard({ place, collapsed = false, onNavigate }: ProMenuCardProps) {
  const { t: tr, locale, productCountry } = useLocalization();
  const upsell = useProUpsell(place);
  if (!upsell) return null;

  const label = upsell.trialAvailable ? tr("Prova gratis") : tr("Scopri Pro");
  const open = () => {
    track("pro_nudge_opened", { place });
    onNavigate?.();
  };
  const areas = isCountryPathAvailable(productCountry, "/pensione") ? tr("Patrimonio, investimenti, pensione e debiti.") : tr("Patrimonio, investimenti e debiti.");
  const price = formatProPrice(PRO_PRICE_CENTS.month, locale);
  const text = `${areas} ${upsell.trialAvailable ? tr("{0} giorni gratis, poi {1} al mese.", { 0: PRO_TRIAL_DAYS, 1: price }) : tr("Da {0} al mese.", { 0: price })}`;

  if (place === "sidebar" && collapsed) {
    return (
      <Link
        href={upsell.href}
        onClick={open}
        title={tr("Passa a Pro")}
        aria-label={tr("Passa a Pro")}
        className="mx-auto mt-3 flex size-10 items-center justify-center rounded-full bg-sun text-on-sun transition-colors hover:bg-sun-hover"
      >
        <Sparkles className="size-4" aria-hidden="true" />
      </Link>
    );
  }

  if (place === "sidebar") {
    return (
      <div className="mt-4 flex flex-col gap-2.5 rounded-xl bg-sidebar-accent/60 p-3">
        <div className="flex flex-col gap-0.5">
          <p className="font-heading text-sm font-semibold text-sidebar-foreground">{tr("Passa a Pro")}</p>
          <p className="text-[11px] leading-snug text-sidebar-foreground/65">{text}</p>
        </div>
        <Link href={upsell.href} onClick={open} className={cn(buttonVariants({ variant: "sun", size: "sm" }), "h-8 w-full rounded-full")}>
          {label}
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-2xl bg-card p-4">
      <div className="flex flex-col gap-0.5">
        <p className="font-heading text-[15px] font-semibold leading-tight">{tr("Passa a Pro")}</p>
        <p className="text-xs leading-snug text-text-2">{text}</p>
      </div>
      <Link href={upsell.href} onClick={open} className={cn(buttonVariants({ variant: "sun" }), "h-11 w-full rounded-full text-[15px]")}>
        {label}
      </Link>
    </div>
  );
}
