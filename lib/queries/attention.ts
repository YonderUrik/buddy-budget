"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AttentionSummary } from "@/lib/attention";

export const ATTENTION_QUERY_KEY = ["attention"] as const;

/** Il conteggio cambia solo con import e categorizzazioni: un minuto di cache basta a non rileggerlo a ogni pagina. */
const ATTENTION_STALE_MS = 60 * 1000;

/** Conteggi di transazioni nuove e da categorizzare, per sidebar e Panoramica. Un errore non deve disturbare la navigazione. */
export function useAttentionQuery() {
  return useQuery({
    queryKey: ATTENTION_QUERY_KEY,
    staleTime: ATTENTION_STALE_MS,
    retry: false,
    queryFn: async (): Promise<AttentionSummary> => {
      const response = await fetch("/api/transactions/attention");
      if (!response.ok) throw new Error("Impossibile caricare gli avvisi sui movimenti");
      return response.json();
    },
  });
}

/**
 * Da chiamare nelle schermate dei movimenti: all'apertura segna le transazioni importate finora come viste, così
 * "nuove" restano solo quelle che arrivano dopo. Best-effort: un errore non deve mai disturbare la pagina.
 */
export function useMarkMovementsSeen(): void {
  const queryClient = useQueryClient();
  const { mutate } = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/transactions/attention/seen", { method: "POST" });
      if (!response.ok) throw new Error("Impossibile aggiornare l'ultima visita");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ATTENTION_QUERY_KEY }),
  });
  React.useEffect(() => {
    mutate();
  }, [mutate]);
}
