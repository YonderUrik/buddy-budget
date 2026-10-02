"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { track } from "@/lib/analytics";
import type { PensionOverviewData } from "@/lib/pension/types";
import type { CreatePensionFundInput, CreatePensionSnapshotInput, UpdatePensionFundInput } from "@/lib/validation/pension";

export const PENSION_QUERY_KEY = ["pension"] as const;
/** Quanto restano valide le cifre della previdenza: cambiano solo per azioni dell'utente. */
const PENSION_STALE_TIME_MS = 60 * 1000;

async function readError(response: Response, fallback: string): Promise<Error> {
  const body = await response.json().catch(() => null);
  return new Error(body?.error ?? fallback);
}

/** Invalida anche il patrimonio netto: la previdenza ne è una classe di asset. */
function useInvalidatePension() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: [...PENSION_QUERY_KEY] });
    queryClient.invalidateQueries({ queryKey: ["net-worth-snapshots"] });
    queryClient.invalidateQueries({ queryKey: ["investments", "sidebar-summary"] });
  };
}

/** Fondi di previdenza dell'utente con le fotografie: una sola richiesta per tutte le schede. */
export function usePensionQuery() {
  return useQuery<PensionOverviewData>({
    queryKey: [...PENSION_QUERY_KEY],
    staleTime: PENSION_STALE_TIME_MS,
    queryFn: async () => {
      const response = await fetch("/api/pension");
      if (!response.ok) throw await readError(response, "Impossibile caricare la previdenza");
      return response.json();
    },
  });
}

async function send(url: string, method: string, body: unknown, fallback: string): Promise<Response> {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw await readError(response, fallback);
  return response;
}

/** Aggiunge un fondo; restituisce l'id. */
export function useCreatePensionFundMutation() {
  const invalidate = useInvalidatePension();
  return useMutation({
    mutationFn: async (input: CreatePensionFundInput): Promise<{ id: string }> =>
      (await send("/api/pension/funds", "POST", input, "Impossibile aggiungere il fondo")).json(),
    onSuccess: () => {
      track("pension_fund_added");
      invalidate();
    },
  });
}

/** Cambia nome o data di adesione di un fondo. */
export function useUpdatePensionFundMutation() {
  const invalidate = useInvalidatePension();
  return useMutation({
    mutationFn: async ({ fundId, input }: { fundId: string; input: UpdatePensionFundInput }) => {
      await send(`/api/pension/funds/${fundId}`, "PATCH", input, "Impossibile aggiornare il fondo");
    },
    onSuccess: () => {
      track("pension_fund_updated");
      invalidate();
    },
  });
}

/** Elimina un fondo con tutte le sue fotografie. */
export function useDeletePensionFundMutation() {
  const invalidate = useInvalidatePension();
  return useMutation({
    mutationFn: async (fundId: string) => {
      await send(`/api/pension/funds/${fundId}`, "DELETE", undefined, "Impossibile eliminare il fondo");
    },
    onSuccess: () => {
      track("pension_fund_deleted");
      invalidate();
    },
  });
}

/** Salva la fotografia di un fondo (sostituisce quella dello stesso giorno). `existing` = fotografie già presenti, per l'evento di prodotto. */
export function useSavePensionSnapshotMutation() {
  const invalidate = useInvalidatePension();
  return useMutation({
    mutationFn: async ({ fundId, input }: { fundId: string; input: CreatePensionSnapshotInput; existing: number }) => {
      await send(`/api/pension/funds/${fundId}/snapshots`, "POST", input, "Impossibile salvare i valori del fondo");
    },
    onSuccess: (_data, variables) => {
      track("pension_snapshot_saved", { existing: variables.existing });
      invalidate();
    },
  });
}

/** Elimina una fotografia di un fondo. */
export function useDeletePensionSnapshotMutation() {
  const invalidate = useInvalidatePension();
  return useMutation({
    mutationFn: async ({ fundId, snapshotId }: { fundId: string; snapshotId: string }) => {
      await send(`/api/pension/funds/${fundId}/snapshots/${snapshotId}`, "DELETE", undefined, "Impossibile eliminare la fotografia");
    },
    onSuccess: () => {
      track("pension_snapshot_deleted");
      invalidate();
    },
  });
}
