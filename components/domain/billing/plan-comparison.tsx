"use client";

import type * as React from "react";
import { Check } from "lucide-react";
import { isCountryPathAvailable } from "@/lib/localization/config";
import { useLocalization } from "@/lib/localization/provider";
import { cn } from "@/lib/utils";
import { FREE_FEATURES, PRO_FEATURES, type PlanFeatureLine } from "./plan-features";

export interface PlanComparisonProps {
  /** Plan of the account, to mark the current one. */
  current: "free" | "pro";
  /** Price line under the Pro title, when there is no offer (hidden in the native app, where prices are not shown). */
  proPrice?: string | null;
  /** The purchase block inside the Pro card (price tiles and button); replaces the price line. */
  offer?: React.ReactNode;
  freeFeatures?: readonly PlanFeatureLine[];
  proFeatures?: readonly PlanFeatureLine[];
}

interface PlanCardProps {
  title: string;
  tagline: string;
  lines: readonly PlanFeatureLine[];
  pro: boolean;
  current: boolean;
  children?: React.ReactNode;
  className?: string;
}

function PlanCard({ title, tagline, lines, pro, current, children, className }: PlanCardProps) {
  const { t: tr, productCountry } = useLocalization();
  return (
    <section
      aria-label={tr(title)}
      className={cn("flex flex-col gap-5 rounded-3xl p-5 sm:p-7", pro ? "bg-brand-navy text-on-brand-navy" : "bg-card", className)}
    >
      <header className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-5xl leading-none font-light">{tr(title)}</h2>
          {current ? (
            <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", pro ? "bg-sun text-on-sun" : "bg-muted text-foreground")}>{tr("Il tuo piano")}</span>
          ) : null}
        </div>
        <p className={cn("text-sm", pro ? "text-on-brand-navy-2" : "text-text-2")}>{tagline}</p>
      </header>
      {children}
      <ul className="flex flex-col gap-3">
        {lines
          .filter((line) => !line.path || isCountryPathAvailable(productCountry, line.path))
          .map((line) => (
            <li key={line.label} className="flex items-start gap-3 text-[15px] leading-snug">
              <Check className={cn("mt-0.5 size-4 shrink-0", pro ? "text-sun" : "text-pos")} strokeWidth={2.5} aria-hidden="true" />
              <span>{tr(line.label)}</span>
            </li>
          ))}
      </ul>
    </section>
  );
}

/**
 * Free and Pro side by side, Pro on the right and wider; on the phone Pro comes first. Pro is the navy card and carries
 * the purchase block (`offer`); each list shows only what exists in the user's country.
 */
export function PlanComparison({ current, proPrice, offer, freeFeatures = FREE_FEATURES, proFeatures = PRO_FEATURES }: PlanComparisonProps) {
  const { t: tr } = useLocalization();
  return (
    <div className="grid items-start gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] md:gap-4">
      <PlanCard title="Gratis" tagline={tr("0 €, per sempre. Per tenere d'occhio conti e spese.")} lines={freeFeatures} pro={false} current={current === "free"} className="order-2 md:order-1" />
      <PlanCard title="Pro" tagline={offer || !proPrice ? tr("Tutto sbloccato, senza limiti.") : proPrice} lines={proFeatures} pro current={current === "pro"} className="order-1 md:order-2">
        {offer}
      </PlanCard>
    </div>
  );
}
