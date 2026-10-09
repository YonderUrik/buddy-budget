"use client";

import { useQuery } from "@tanstack/react-query";
import type { SidebarDeadlines, SidebarFire, SidebarSummary } from "@/lib/sidebar/types";

/** I prezzi sono di chiusura: rileggere il riepilogo più spesso non porta dati nuovi. */
const SIDEBAR_SUMMARY_STALE_MS = 5 * 60 * 1000;

/** Riepilogo finanziario per la sidebar (patrimonio, portafoglio, watchlist). Un errore non deve disturbare la navigazione. */
export function useSidebarSummaryQuery(enabled = true) {
  return useQuery({
    queryKey: ["investments", "sidebar-summary"] as const,
    enabled,
    staleTime: SIDEBAR_SUMMARY_STALE_MS,
    retry: false,
    queryFn: async (): Promise<SidebarSummary> => {
      const response = await fetch("/api/sidebar/summary");
      if (!response.ok) throw new Error("Impossibile caricare il riepilogo");
      return response.json();
    },
  });
}

/** Le scadenze si muovono di giorno in giorno, non di minuto. */
const SIDEBAR_DEADLINES_STALE_MS = 10 * 60 * 1000;
/** Il numero FIRE cambia con i prezzi di chiusura e le ipotesi: un'ora basta, il calcolo è il più pesante della sidebar. */
const SIDEBAR_FIRE_STALE_MS = 60 * 60 * 1000;

/** Prossime scadenze per la sidebar; `enabled` false (modulo spento) non fa nessuna richiesta. */
export function useSidebarDeadlinesQuery(enabled = true) {
  return useQuery({
    queryKey: ["sidebar", "deadlines"] as const,
    enabled,
    staleTime: SIDEBAR_DEADLINES_STALE_MS,
    retry: false,
    queryFn: async (): Promise<SidebarDeadlines> => {
      const response = await fetch("/api/sidebar/deadlines");
      if (!response.ok) throw new Error("Impossibile caricare le scadenze");
      return response.json();
    },
  });
}

/** Avanzamento verso il numero FIRE per la sidebar; `enabled` false (modulo spento) non fa nessuna richiesta. */
export function useSidebarFireQuery(enabled = true) {
  return useQuery({
    queryKey: ["sidebar", "fire"] as const,
    enabled,
    staleTime: SIDEBAR_FIRE_STALE_MS,
    retry: false,
    queryFn: async (): Promise<SidebarFire> => {
      const response = await fetch("/api/sidebar/fire");
      if (!response.ok) throw new Error("Impossibile caricare l'obiettivo FIRE");
      return response.json();
    },
  });
}
