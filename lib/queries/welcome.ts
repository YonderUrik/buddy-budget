"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { pageText } from "@/lib/localization/page-text";
import { VISIT_HEARTBEAT_MS, VISIT_TOUCH_THROTTLE_MS, type WelcomeResponse } from "@/lib/welcome";

export const WELCOME_QUERY_KEY = ["welcome"] as const;

/** «Dall'ultima visita» summary for the toast: read once per page load and again when a new visit starts. An error shows nothing. */
export function useWelcomeQuery(enabled = true) {
  return useQuery({
    queryKey: WELCOME_QUERY_KEY,
    enabled,
    staleTime: Infinity,
    retry: false,
    queryFn: async (): Promise<WelcomeResponse> => {
      const response = await fetch("/api/welcome");
      if (!response.ok) throw new Error(pageText("Impossibile caricare il riepilogo"));
      return response.json();
    },
  });
}

/** Tells the server the toast appeared, so it is not shown again in this visit. Best-effort. */
export function markWelcomeShown(): void {
  void fetch("/api/welcome", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shown: true }),
  }).catch(() => {});
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
