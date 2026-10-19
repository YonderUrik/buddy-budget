"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { LoadError, PAGE_TITLE } from "@/components/domain/shared";
import { PRO_AREAS, PRO_PRICE_CENTS, formatProPrice, type ProAreaId } from "@/lib/billing";
import { useLocalization } from "@/lib/localization/provider";
import { AccessCodeForm } from "./access-code-form";
import { PlanComparison } from "./plan-comparison";
import { PlanStatusCard } from "./plan-status-card";
import { ProOffer } from "./pro-offer";
import { usePlansScreen, type UsePlansScreenOptions } from "./use-plans-screen";

/** Names of the Pro areas, for the «… fa parte di Pro» line. */
const AREA_NAMES: Record<ProAreaId, string> = {
  panoramica: "Panoramica",
  investimenti: "Investimenti",
  pensione: "Pensione",
  debiti: "Debiti",
  analitiche: "Analitiche",
};

export type PlansScreenProps = UsePlansScreenOptions;

/**
 * Plans page (`/pro`): where a locked section leads. Free and Pro compared, monthly/yearly with the 14 free days, the
 * plan's status with the Stripe portal, and access codes. In the native app nothing can be bought or redeemed (store
 * rules): the page only says what the plan includes and the status of a Pro bought on the web.
 */
export function PlansScreen(props: PlansScreenProps) {
  const { t: tr, locale } = useLocalization();
  const screen = usePlansScreen(props);
  const { plan, status, native } = screen;
  const areaId = props.from && props.from !== "impostazioni" && PRO_AREAS.some((area) => area.id === props.from) ? props.from : null;

  if (!plan.enforced) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6">
        <h1 className={PAGE_TITLE}>{tr("BuddyBudget Pro")}</h1>
        <p className="text-sm text-text-2">{tr("Su questo account è già tutto sbloccato.")}</p>
        <Link href="/panoramica" className="w-fit text-sm font-medium underline underline-offset-4">{tr("Vai alla Panoramica")}</Link>
      </div>
    );
  }

  const data = status.data;
  const tier = data?.plan.tier ?? plan.tier;
  const proPrice = native ? null : tr("{0} al mese o {1} all'anno", { 0: formatProPrice(PRO_PRICE_CENTS.month, locale), 1: formatProPrice(PRO_PRICE_CENTS.year, locale) });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 p-4 sm:gap-6 sm:p-6">
      <div className="flex flex-col gap-1">
        <h1 className={PAGE_TITLE}>{tr("BuddyBudget Pro")}</h1>
        <p className="text-sm text-text-2">
          {areaId && tier === "free" ? tr("{0} fa parte di Pro.", { 0: tr(AREA_NAMES[areaId]) }) : tr("Liquidità è gratis. Con Pro sblocchi tutto il resto, senza limiti.")}
        </p>
      </div>

      {screen.activating ? (
        <p className="flex items-center gap-2 rounded-2xl bg-card p-5 text-sm" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {tr("Pagamento ricevuto, sto attivando Pro…")}
        </p>
      ) : null}
      {screen.activationLate ? (
        <p className="rounded-2xl bg-card p-5 text-sm" role="status">
          {tr("Stripe ha ricevuto il pagamento, ma l'attivazione sta richiedendo più del solito. Ricarica la pagina tra un minuto; se non cambia, scrivici.")}
        </p>
      ) : null}
      {props.checkout === "cancel" && tier === "free" ? (
        <p className="rounded-2xl bg-card p-5 text-sm" role="status">{tr("Pagamento annullato: non ti è stato addebitato nulla.")}</p>
      ) : null}

      {status.isError ? <LoadError message={tr("Impossibile caricare il tuo piano.")} onRetry={() => status.refetch()} /> : null}

      {data && (tier === "pro" || data.subscription) ? (
        <PlanStatusCard status={data} canManage={!native} managing={screen.managing} onManage={screen.manage} error={screen.manageError} />
      ) : null}

      {data && tier === "free" && !data.subscription && !native && data.canPurchase ? (
        <ProOffer trialAvailable={data.trialAvailable} pending={screen.starting} error={screen.startError} onStart={screen.start} />
      ) : null}
      {!data && status.isLoading ? <div className="h-56 animate-pulse rounded-2xl bg-muted" aria-busy="true" /> : null}

      <PlanComparison current={tier} proPrice={proPrice} />

      {data && tier === "free" && !native ? <AccessCodeForm pending={screen.redeeming} error={screen.redeemError} onRedeem={screen.redeemCode} /> : null}
      {native && tier === "free" ? <p className="text-sm text-text-2">{tr("Questa sezione non è inclusa nel tuo piano.")}</p> : null}
    </div>
  );
}
