"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NotificationPreferences } from "@/lib/notifications";
import type { UpdateNotificationPreferencesInput } from "@/lib/validation/notifications";

const NOTIFICATIONS_KEY = ["notification-preferences"] as const;

async function failure(response: Response, fallback: string): Promise<Error> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return new Error(body?.error ?? fallback);
}

/** Preferenze sulle email di riepilogo e avviso. */
export function useNotificationPreferencesQuery() {
  return useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: async () => {
      const response = await fetch("/api/user/notifications");
      if (!response.ok) throw await failure(response, "Impossibile caricare le notifiche");
      return (await response.json()) as NotificationPreferences;
    },
  });
}

/** Salva una o più preferenze; la lista si aggiorna subito con la risposta del server. */
export function useUpdateNotificationPreferencesMutation() {
  const queryClient = useQueryClient();
  return useMutation<NotificationPreferences, Error, UpdateNotificationPreferencesInput>({
    mutationFn: async (input) => {
      const response = await fetch("/api/user/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw await failure(response, "Impossibile salvare le preferenze");
      return (await response.json()) as NotificationPreferences;
    },
    onSuccess: (preferences) => queryClient.setQueryData(NOTIFICATIONS_KEY, preferences),
  });
}

/** Chiede l'invio di un esempio del riepilogo all'indirizzo dell'account. */
export function useSendNotificationExampleMutation() {
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      const response = await fetch("/api/user/notifications/test", { method: "POST" });
      if (!response.ok) throw await failure(response, "Impossibile inviare l'esempio");
    },
  });
}

const AI_CATEGORIZATION_KEY = ["ai-categorization-consent"] as const;

/** Stato del consenso alle proposte automatiche di categoria. */
export interface AiCategorizationState {
  enabled: boolean;
  available: boolean;
  instructions: string;
  /** Le proposte sicure (dal 90%) si applicano da sole. */
  autoApply: boolean;
}

/** Legge il consenso alle proposte dell'assistente. */
export function useAiCategorizationQuery() {
  return useQuery({
    queryKey: AI_CATEGORIZATION_KEY,
    queryFn: async () => {
      const response = await fetch("/api/user/ai-categorization");
      if (!response.ok) throw await failure(response, "Impossibile caricare l'impostazione");
      return (await response.json()) as AiCategorizationState;
    },
  });
}

/** Attiva o revoca il consenso alle proposte dell'assistente, salva le istruzioni o accende l'applicazione automatica. */
export function useUpdateAiCategorizationMutation() {
  const queryClient = useQueryClient();
  return useMutation<AiCategorizationState, Error, boolean | { instructions: string } | { autoApply: boolean }>({
    mutationFn: async (enabled) => {
      const response = await fetch("/api/user/ai-categorization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(typeof enabled === "boolean" ? { enabled } : enabled),
      });
      if (!response.ok) throw await failure(response, "Impossibile salvare l'impostazione");
      return (await response.json()) as AiCategorizationState;
    },
    onSuccess: (state) => {
      queryClient.setQueryData(AI_CATEGORIZATION_KEY, state);
      queryClient.invalidateQueries({ queryKey: ["categorize-suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["auto-categorized"] });
    },
  });
}

const PUSH_DEVICES_KEY = ["push-devices"] as const;

/** Phones with notifications on for this account, and whether the server can send them at all. */
export interface PushDevicesState {
  configured: boolean;
  devices: number;
}

/** Push state of the account (number of phones), for the «Sul telefono» row in Notifiche. */
export function usePushDevicesQuery() {
  return useQuery({
    queryKey: PUSH_DEVICES_KEY,
    queryFn: async () => {
      const response = await fetch("/api/user/push-devices");
      if (!response.ok) throw await failure(response, "Impossibile caricare le notifiche sul telefono");
      return (await response.json()) as PushDevicesState;
    },
  });
}

/** Re-reads the phones after this phone registered or removed its token (done by `lib/native`). */
export function useInvalidatePushDevices() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: PUSH_DEVICES_KEY });
}

/** Sends a test notification to the account's phones. */
export function useSendPushTestMutation() {
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      const response = await fetch("/api/user/push-devices/test", { method: "POST" });
      if (!response.ok) throw await failure(response, "Impossibile mandare la notifica di prova");
    },
  });
}
