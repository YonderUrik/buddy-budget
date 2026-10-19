"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BillingInterval } from "@/lib/db/schema/billing";
import type { BillingStatus } from "@/lib/billing/status";
import { pageText } from "@/lib/localization/page-text";

export type { BillingStatus };

const BILLING_STATUS_KEY = ["billing", "status"] as const;

async function errorOf(response: Response, fallback: string): Promise<Error> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return new Error(body?.error ?? pageText(fallback));
}

/**
 * Plan and subscription of the account; `refresh` re-reads Stripe first (back from Checkout), `pollUntilPro` re-asks
 * every so many milliseconds until the plan is Pro.
 */
export function useBillingStatusQuery(options: { enabled?: boolean; refresh?: boolean; pollUntilPro?: number | false } = {}) {
  const { enabled = true, refresh = false, pollUntilPro = false } = options;
  return useQuery({
    queryKey: [...BILLING_STATUS_KEY, refresh] as const,
    enabled,
    refetchInterval: (query) => (pollUntilPro && query.state.data?.plan.tier !== "pro" ? pollUntilPro : false),
    queryFn: async (): Promise<BillingStatus> => {
      const response = await fetch(`/api/billing/status${refresh ? "?refresh=1" : ""}`, { cache: "no-store" });
      if (!response.ok) throw await errorOf(response, "Impossibile caricare il tuo piano.");
      return response.json();
    },
  });
}

/** Opens Stripe Checkout for Pro; resolves with the address to go to. */
export function useStartCheckoutMutation() {
  return useMutation({
    mutationFn: async (interval: BillingInterval): Promise<{ url: string; trial: boolean }> => {
      const response = await fetch("/api/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ interval }) });
      if (!response.ok) throw await errorOf(response, "Non riusciamo ad aprire il pagamento adesso. Riprova tra poco.");
      return response.json();
    },
  });
}

/** Opens the Stripe Customer Portal; resolves with its address. */
export function useOpenPortalMutation() {
  return useMutation({
    mutationFn: async (): Promise<{ url: string }> => {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      if (!response.ok) throw await errorOf(response, "Non riusciamo ad aprire la gestione dell'abbonamento adesso. Riprova tra poco.");
      return response.json();
    },
  });
}

/** Redeems an access code; on success the plan is re-read. */
export function useRedeemCodeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (code: string): Promise<BillingStatus & { forGood: boolean }> => {
      const response = await fetch("/api/billing/redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      if (!response.ok) throw await errorOf(response, "Non riusciamo a usare il codice adesso. Riprova tra poco.");
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BILLING_STATUS_KEY }),
  });
}
