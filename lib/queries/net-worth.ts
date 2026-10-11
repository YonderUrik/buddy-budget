"use client";

import { useQuery } from "@tanstack/react-query";
import type { NetWorthSnapshot } from "@/lib/db/schema/net-worth-snapshots";

/** Gli snapshot li scrive il cron e li ricalcola il server: pochi minuti di cache evitano di riscaricare lo storico (centinaia di KB) a ogni cambio pagina. */
const SNAPSHOTS_STALE_TIME_MS = 2 * 60_000;

async function fetchNetWorthSnapshots(from: string, to: string, compact: boolean): Promise<NetWorthSnapshot[]> {
  const response = await fetch(`/api/net-worth/snapshots?from=${from}&to=${to}${compact ? "&compact=1" : ""}`);
  if (!response.ok) {
    throw new Error("Impossibile caricare lo storico del patrimonio");
  }
  return response.json();
}

/**
 * Recupera le righe snapshot del patrimonio netto dell'utente nell'intervallo [from, to] (YYYY-MM-DD). Con `compact` le righe
 * oltre l'ultimo anno arrivano ridotte a una per mese: basta ai grafici e pesa una frazione.
 */
export function useNetWorthSnapshotsQuery(from: string, to: string, { compact = false }: { compact?: boolean } = {}) {
  return useQuery({
    queryKey: ["net-worth-snapshots", from, to, compact] as const,
    queryFn: () => fetchNetWorthSnapshots(from, to, compact),
    staleTime: SNAPSHOTS_STALE_TIME_MS,
  });
}
