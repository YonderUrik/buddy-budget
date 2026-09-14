"use client";

import { useQuery } from "@tanstack/react-query";
import type { NetWorthSnapshot } from "@/lib/db/schema/net-worth-snapshots";

async function fetchNetWorthSnapshots(from: string, to: string): Promise<NetWorthSnapshot[]> {
  const response = await fetch(`/api/net-worth/snapshots?from=${from}&to=${to}`);
  if (!response.ok) {
    throw new Error("Impossibile caricare lo storico del patrimonio");
  }
  return response.json();
}

/** Recupera le righe snapshot del patrimonio netto dell'utente nell'intervallo [from, to] (YYYY-MM-DD). */
export function useNetWorthSnapshotsQuery(from: string, to: string) {
  return useQuery({
    queryKey: ["net-worth-snapshots", from, to] as const,
    queryFn: () => fetchNetWorthSnapshots(from, to),
  });
}
