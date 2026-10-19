"use client";

import { Check } from "lucide-react";
import { isCountryPathAvailable } from "@/lib/localization/config";
import { useLocalization } from "@/lib/localization/provider";
import { cn } from "@/lib/utils";
import { FREE_FEATURES, PRO_FEATURES, type PlanFeatureLine } from "./plan-features";

export interface PlanComparisonProps {
  /** Plan of the account, to mark the current one. */
  current: "free" | "pro";
  /** Price line under the Pro title (hidden in the native app, where prices are not shown). */
  proPrice?: string | null;
  freeFeatures?: readonly PlanFeatureLine[];
  proFeatures?: readonly PlanFeatureLine[];
}

function PlanCard({ title, price, lines, highlighted, current }: { title: string; price: string; lines: readonly PlanFeatureLine[]; highlighted: boolean; current: boolean }) {
  const { t: tr, productCountry } = useLocalization();
  return (
    <section className={cn("flex flex-col gap-4 rounded-2xl p-5", highlighted ? "bg-primary text-primary-foreground" : "bg-card")}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-3xl font-bold leading-none tracking-tight">{tr(title)}</h2>
        {current ? (
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", highlighted ? "bg-sun text-on-sun" : "bg-muted text-foreground")}>{tr("Il tuo piano")}</span>
        ) : null}
      </div>
      <p className={cn("text-sm font-medium tabular-nums", highlighted ? "text-primary-foreground/80" : "text-text-2")}>{price}</p>
      <ul className="flex flex-col gap-2.5">
        {lines
          .filter((line) => !line.path || isCountryPathAvailable(productCountry, line.path))
          .map((line) => (
            <li key={line.label} className="flex items-start gap-2.5 text-sm">
              <Check className={cn("mt-0.5 size-4 shrink-0", highlighted ? "text-sun" : "text-pos")} aria-hidden="true" />
              <span>{tr(line.label)}</span>
            </li>
          ))}
      </ul>
    </section>
  );
}

/** Free and Pro side by side (stacked on the phone), with what each one opens in the user's country. */
export function PlanComparison({ current, proPrice, freeFeatures = FREE_FEATURES, proFeatures = PRO_FEATURES }: PlanComparisonProps) {
  const { t: tr } = useLocalization();
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <PlanCard title="Gratis" price={tr("0 €, per sempre")} lines={freeFeatures} highlighted={false} current={current === "free"} />
      <PlanCard title="Pro" price={proPrice ?? tr("Tutto sbloccato")} lines={proFeatures} highlighted current={current === "pro"} />
    </div>
  );
}
