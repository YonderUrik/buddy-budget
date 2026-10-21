"use client";

import * as React from "react";
import { PRO_PAGE_PATH } from "@/lib/billing";
import { nativePlatform } from "@/lib/native/shell";
import { useBillingStatusQuery } from "@/lib/queries/billing";
import { usePlan } from "./plan-provider";
import type { ProNudgePlace } from "./pro-nudge-places";

/** The shell is fixed for the page's life: nothing to subscribe to. */
const subscribeNoop = () => () => {};

/** What an invitation to Pro needs: where it leads and whether the 14 free days still apply. */
export interface ProUpsell {
  href: string;
  trialAvailable: boolean;
}

/**
 * Whether to invite this account to Pro, and how: only a Free account where plans apply, never in the native app (no
 * purchase there), on self-hosted installs or in the public demo (both always Pro). The trial is assumed until the
 * status says otherwise, so the first paint does not jump.
 */
export function useProUpsell(place: ProNudgePlace): ProUpsell | null {
  const plan = usePlan();
  const native = React.useSyncExternalStore(subscribeNoop, () => nativePlatform() !== null, () => false);
  const eligible = plan.enforced && plan.tier === "free" && !native;
  const status = useBillingStatusQuery({ enabled: eligible });
  if (!eligible) return null;
  return { href: `${PRO_PAGE_PATH}?da=${place}`, trialAvailable: status.data?.trialAvailable ?? true };
}
