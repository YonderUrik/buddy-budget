"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { SettingsSection } from "@/components/domain/settings";
import { buttonVariants } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { PRO_PAGE_PATH, PRO_TRIAL_DAYS } from "@/lib/billing";
import { useLocalization } from "@/lib/localization/provider";
import { useBillingStatusQuery } from "@/lib/queries/billing";
import { cn } from "@/lib/utils";
import { PlanStatusCard } from "./plan-status-card";
import { usePlan } from "./plan-provider";
import { useProUpsell } from "./use-pro-upsell";

/**
 * Settings → Account: the plan as a filled block (name, one sentence) with one action: the yellow trial button on Free,
 * «Gestisci il piano» on Pro, «Cosa include Pro» in the native app. Shown only where plans apply.
 */
export function PlanSection() {
  const { t: tr } = useLocalization();
  const plan = usePlan();
  const status = useBillingStatusQuery({ enabled: plan.enforced });
  const upsell = useProUpsell("impostazioni");
  if (!plan.enforced) return null;

  const action = upsell ? (
    <Link
      href={upsell.href}
      onClick={() => track("pro_nudge_opened", { place: "impostazioni" })}
      className={cn(buttonVariants({ variant: "sun" }), "h-11 w-fit shrink-0 rounded-full px-5")}
    >
      {upsell.trialAvailable ? tr("Prova {0} giorni gratis", { 0: PRO_TRIAL_DAYS }) : tr("Scopri Pro")}
    </Link>
  ) : (
    <Link href={`${PRO_PAGE_PATH}?da=impostazioni`} className={cn(buttonVariants({ variant: "outline" }), "h-11 w-fit shrink-0 rounded-full px-5")}>
      {plan.tier === "pro" ? tr("Gestisci il piano") : tr("Cosa include Pro")}
    </Link>
  );

  return (
    <SettingsSection id="impostazioni-piano" title={tr("Piano")} icon={Sparkles}>
      {status.data ? (
        <PlanStatusCard status={status.data} canManage={false} managing={false} onManage={() => {}} action={action} />
      ) : (
        <div className="h-32 animate-pulse rounded-2xl bg-muted sm:h-28" aria-busy="true" />
      )}
    </SettingsSection>
  );
}
