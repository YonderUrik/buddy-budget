"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { track } from "@/lib/analytics";
import type { ProAreaId } from "@/lib/billing";
import type { BillingInterval } from "@/lib/db/schema/billing";
import { nativePlatform } from "@/lib/native/shell";
import { useLocalization } from "@/lib/localization/provider";
import { useBillingStatusQuery, useOpenPortalMutation, useRedeemCodeMutation, useStartCheckoutMutation } from "@/lib/queries/billing";
import { usePlan } from "./plan-provider";

/** How often and for how long the page re-reads the plan after Checkout, while the webhook is on its way. */
const ACTIVATION_POLL_MS = 2_000;
const ACTIVATION_TIMEOUT_MS = 30_000;

/** The shell is fixed for the page's life: nothing to subscribe to. */
const subscribeNoop = () => () => {};

export interface UsePlansScreenOptions {
  from: ProAreaId | "impostazioni" | null;
  checkout: "success" | "cancel" | null;
}

/** State and actions of the plans page: status, Checkout, portal, codes, and the wait for Pro after paying. */
export function usePlansScreen({ from, checkout }: UsePlansScreenOptions) {
  const { t: tr } = useLocalization();
  const router = useRouter();
  const plan = usePlan();
  const native = React.useSyncExternalStore(subscribeNoop, () => nativePlatform() !== null, () => false);
  const [late, setLate] = React.useState(false);
  const activated = React.useRef(false);
  const waiting = checkout === "success" && !late;
  const status = useBillingStatusQuery({ enabled: plan.enforced, refresh: checkout === "success", pollUntilPro: waiting ? ACTIVATION_POLL_MS : false });
  const startCheckout = useStartCheckoutMutation();
  const openPortal = useOpenPortalMutation();
  const redeem = useRedeemCodeMutation();

  React.useEffect(() => {
    track("pro_page_viewed", { from: from ?? "none" });
  }, [from]);

  // Back from Checkout: the plan turns Pro when the webhook arrives (or the refresh reads Stripe); then the layout is
  // re-rendered so the locks go away. After ACTIVATION_TIMEOUT_MS the page stops asking and says so.
  const tier = status.data?.plan.tier;
  const source = status.data?.plan.source;
  React.useEffect(() => {
    if (checkout !== "success") return;
    const timer = window.setTimeout(() => setLate(true), ACTIVATION_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [checkout]);
  React.useEffect(() => {
    if (checkout !== "success" || tier !== "pro" || activated.current) return;
    activated.current = true;
    track("pro_activated", { source: source ?? "subscription" });
    toast.success(tr("Pro è attivo: è tutto sbloccato."));
    router.replace("/pro");
    router.refresh();
  }, [checkout, tier, source, router, tr]);

  const start = (interval: BillingInterval) =>
    startCheckout.mutate(interval, {
      onSuccess: ({ url, trial }) => {
        track("pro_checkout_started", { interval, trial });
        window.location.assign(url);
      },
    });
  const manage = () =>
    openPortal.mutate(undefined, {
      onSuccess: ({ url }) => {
        track("pro_portal_opened");
        window.location.assign(url);
      },
    });
  const redeemCode = (code: string) =>
    redeem.mutate(code, {
      onSuccess: ({ forGood }) => {
        track("access_code_redeemed", { forGood });
        toast.success(tr("Codice accettato: Pro è attivo."));
        router.refresh();
      },
    });

  return {
    plan,
    native,
    status,
    activating: waiting && tier !== "pro",
    activationLate: checkout === "success" && late && tier !== "pro",
    start,
    starting: startCheckout.isPending || startCheckout.isSuccess,
    startError: startCheckout.error?.message ?? null,
    manage,
    managing: openPortal.isPending || openPortal.isSuccess,
    manageError: openPortal.error?.message ?? null,
    redeemCode,
    redeeming: redeem.isPending,
    redeemError: redeem.error?.message ?? null,
  };
}
