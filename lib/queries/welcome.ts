"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { track } from "@/lib/analytics";
import { pageText } from "@/lib/localization/page-text";
import { VISIT_HEARTBEAT_MS, VISIT_TOUCH_THROTTLE_MS, type WelcomeResponse } from "@/lib/welcome";

export const WELCOME_QUERY_KEY = ["welcome"] as const;

/** The summary changes only with a new visit (the heartbeat invalidates it) or with the user's own actions. */
const WELCOME_STALE_MS = 5 * 60 * 1000;

/** «Dall'ultima visita» summary for Panoramica. An error hides it: it never gets in the way of the page. */
export function useWelcomeQuery(enabled = true) {
  return useQuery({
    queryKey: WELCOME_QUERY_KEY,
    enabled,
    staleTime: WELCOME_STALE_MS,
    retry: false,
    queryFn: async (): Promise<WelcomeResponse> => {
      const response = await fetch("/api/welcome");
      if (!response.ok) throw new Error(pageText("Impossibile caricare il riepilogo"));
      return response.json();
    },
  });
}

/** Closes the summary until the next visit; the card disappears at once. */
export function useWelcomeDismissMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { items: number }, { previous: WelcomeResponse | undefined }>({
    mutationFn: async () => {
      const response = await fetch("/api/welcome", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dismissed: true }),
      });
      if (!response.ok) throw new Error(pageText("Impossibile chiudere il riepilogo"));
    },
    onMutate: () => {
      const previous = queryClient.getQueryData<WelcomeResponse>(WELCOME_QUERY_KEY);
      if (previous) queryClient.setQueryData<WelcomeResponse>(WELCOME_QUERY_KEY, { ...previous, summary: null });
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(WELCOME_QUERY_KEY, context.previous);
    },
    onSuccess: (_data, { items }) => track("welcome_summary_dismissed", { items }),
  });
}

/**
 * Heartbeat of the open app, mounted once in the layout: on load, when the tab or the installed app comes back to the
 * foreground, and every few minutes while visible. A heartbeat that starts a new visit re-reads the summary.
 * Best-effort: errors are ignored.
 */
export function useVisitHeartbeat(enabled = true): void {
  const queryClient = useQueryClient();
  React.useEffect(() => {
    if (!enabled) return;
    let lastSent = 0;
    const beat = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastSent < VISIT_TOUCH_THROTTLE_MS) return;
      lastSent = Date.now();
      void fetch("/api/visits", { method: "POST" })
        .then((response) => (response.ok ? (response.json() as Promise<{ newVisit: boolean }>) : null))
        .then((result) => {
          if (result?.newVisit) void queryClient.invalidateQueries({ queryKey: WELCOME_QUERY_KEY });
        })
        .catch(() => {});
    };
    beat();
    const timer = window.setInterval(beat, VISIT_HEARTBEAT_MS);
    document.addEventListener("visibilitychange", beat);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [enabled, queryClient]);
}
