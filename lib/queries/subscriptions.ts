"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { track } from "@/lib/analytics";
import type { SubscriptionsResponse } from "@/lib/subscriptions/data";
import type { CreateSubscriptionInput, UpdateSubscriptionInput } from "@/lib/validation/subscriptions";

const SUBSCRIPTIONS_QUERY_KEY = ["subscriptions"] as const;

async function readError(response: Response, fallback: string): Promise<Error> {
  const body = await response.json().catch(() => null);
  return new Error(body?.error ?? fallback);
}

/** Abbonamenti rilevati e scelti dall'utente, con i totali (il rilevamento gira sul server a ogni richiesta). */
export function useSubscriptionsQuery() {
  return useQuery({
    queryKey: SUBSCRIPTIONS_QUERY_KEY,
    queryFn: async (): Promise<SubscriptionsResponse> => {
      const response = await fetch("/api/subscriptions");
      if (!response.ok) throw new Error("Impossibile caricare gli abbonamenti");
      return response.json();
    },
  });
}

/** Conferma, esclude o chiude un abbonamento rilevato, oppure ne aggiunge uno a mano. */
export function useSaveSubscriptionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateSubscriptionInput) => {
      const response = await fetch("/api/subscriptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      if (!response.ok) throw await readError(response, "Impossibile salvare l'abbonamento");
      return response.json();
    },
    onSuccess: (_row, input) => {
      if (input.origin === "manuale") track("subscription_added", { cadence: input.cadence });
      else track("subscription_decided", { decision: input.status, origin: "rilevato" });
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTIONS_QUERY_KEY });
    },
  });
}

/** Modifica una scelta salvata; `origin` serve solo per l'evento di prodotto quando cambia lo stato. */
export function useUpdateSubscriptionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateSubscriptionInput; origin: "rilevato" | "manuale" }) => {
      const response = await fetch(`/api/subscriptions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      if (!response.ok) throw await readError(response, "Impossibile aggiornare l'abbonamento");
      return response.json();
    },
    onSuccess: (_row, { input, origin }) => {
      if (input.status) track("subscription_decided", { decision: input.status, origin });
      else track("subscription_updated");
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTIONS_QUERY_KEY });
    },
  });
}

/** Toglie la scelta: un rilevato torna «da confermare», uno manuale sparisce. */
export function useDeleteSubscriptionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; origin: "rilevato" | "manuale" }) => {
      const response = await fetch(`/api/subscriptions/${id}`, { method: "DELETE" });
      if (!response.ok) throw await readError(response, "Impossibile rimuovere l'abbonamento");
    },
    onSuccess: (_data, { origin }) => {
      if (origin === "manuale") track("subscription_removed");
      else track("subscription_decided", { decision: "ripristinato", origin });
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTIONS_QUERY_KEY });
    },
  });
}
