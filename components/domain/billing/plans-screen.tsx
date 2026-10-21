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

/** What each Pro area gives, said to a Free account that tapped it in the menu. */
const AREA_PITCH: Record<ProAreaId, string> = {
  panoramica: "Panoramica fa parte di Pro: conti, investimenti, pensione e debiti in un numero solo, il tuo patrimonio netto.",
  investimenti: "Investimenti fa parte di Pro: rendimenti, tasse stimate e diversificazione di quello che hai investito.",
  pensione: "Pensione fa parte di Pro: il fondo pensione accanto al resto, con quanto avrai e quanto risparmi di tasse.",
  debiti: "Debiti fa parte di Pro: quanto manca su mutui e finanziamenti e cosa cambia se anticipi.",
  analitiche: "Analitiche fa parte di Pro: dove arrivi con i tuoi risparmi, simulazioni, FIRE e obiettivi.",
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
  const areaId = PRO_AREAS.find((area) => area.id === props.from)?.id ?? null;

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

  const offer =
    data && tier === "free" && !data.subscription && !native && data.canPurchase ? (
      <ProOffer trialAvailable={data.trialAvailable} pending={screen.starting} error={screen.startError} onStart={screen.start} />
    ) : null;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:gap-8 sm:p-6">
      <header className="flex flex-col gap-2">
        <h1 className={PAGE_TITLE}>{tr("BuddyBudget Pro")}</h1>
        <p className="max-w-[60ch] text-base text-text-2 sm:text-lg">
          {areaId && tier === "free" ? tr(AREA_PITCH[areaId]) : tr("Liquidità è gratis, per sempre. Pro sblocca tutto il resto, senza limiti.")}
        </p>
      </header>

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

      {!data && status.isLoading ? (
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] md:gap-4" aria-busy="true">
          <div className="order-2 h-80 animate-pulse rounded-3xl bg-muted md:order-1" />
          <div className="order-1 h-[34rem] animate-pulse rounded-3xl bg-muted md:order-2" />
        </div>
      ) : (
        <PlanComparison current={tier} proPrice={proPrice} offer={offer} />
      )}

      {data && tier === "free" && !native ? <AccessCodeForm pending={screen.redeeming} error={screen.redeemError} onRedeem={screen.redeemCode} /> : null}
      {native && tier === "free" ? <p className="text-sm text-text-2">{tr("Questa sezione non è inclusa nel tuo piano.")}</p> : null}
    </div>
  );
}
