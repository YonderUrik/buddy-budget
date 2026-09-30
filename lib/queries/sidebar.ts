"use client";

import { useQuery } from "@tanstack/react-query";
import type { SidebarSummary } from "@/lib/sidebar/types";

/** I prezzi sono di chiusura: rileggere il riepilogo più spesso non porta dati nuovi. */
const SIDEBAR_SUMMARY_STALE_MS = 5 * 60 * 1000;

/** Riepilogo finanziario per la sidebar (patrimonio, portafoglio, watchlist). Un errore non deve disturbare la navigazione. */
export function useSidebarSummaryQuery() {
  return useQuery({
    queryKey: ["investments", "sidebar-summary"] as const,
    staleTime: SIDEBAR_SUMMARY_STALE_MS,
    retry: false,
    queryFn: async (): Promise<SidebarSummary> => {
      const response = await fetch("/api/sidebar/summary");
      if (!response.ok) throw new Error("Impossibile caricare il riepilogo");
      return response.json();
    },
  });
}
