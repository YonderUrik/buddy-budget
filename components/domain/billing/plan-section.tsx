"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { SettingsSection } from "@/components/domain/settings";
import { useLocalization } from "@/lib/localization/provider";
import { useBillingStatusQuery } from "@/lib/queries/billing";
import { PlanStatusCard } from "./plan-status-card";
import { usePlan } from "./plan-provider";

/** Settings → Account: the plan in one sentence and a link to the plans page (shown only where plans apply). */
export function PlanSection() {
  const { t: tr } = useLocalization();
  const plan = usePlan();
  const status = useBillingStatusQuery({ enabled: plan.enforced });
  if (!plan.enforced) return null;
  return (
    <SettingsSection id="impostazioni-piano" title={tr("Piano")} icon={Sparkles} description={tr("Liquidità è gratis; Pro sblocca tutte le altre sezioni.")}>
      {status.data ? <PlanStatusCard status={status.data} canManage={false} managing={false} onManage={() => {}} /> : <div className="h-16 animate-pulse rounded-2xl bg-muted" aria-busy="true" />}
      <Link href="/pro?da=impostazioni" className="w-fit text-sm font-medium underline underline-offset-4">
        {plan.tier === "pro" ? tr("Gestisci il piano") : tr("Scopri Pro")}
      </Link>
    </SettingsSection>
  );
}
