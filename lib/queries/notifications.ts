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
