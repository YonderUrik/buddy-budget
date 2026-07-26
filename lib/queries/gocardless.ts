"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CreateConnectionInput, FinalizeSelectionInput } from "@/lib/validation/gocardless";
import { buildSyncErrorMessage, buildSyncSummaryMessage } from "@/lib/gocardless/sync-messages";
import type { SyncErrorInfo, SyncSuccessResult } from "@/lib/gocardless/sync-messages";

export interface Institution {
  id: string;
  name: string;
  transaction_total_days: string;
  logo?: string;
}

export interface BankConnectionStatus {
  accountId: string;
  status: "pending" | "linked" | "expired" | "error";
  lastSyncedAt: string | null;
  eligible: boolean;
  nextEligibleAt: string | null;
  syncsRemainingToday: number;
}

export interface ExternalAccount {
  externalAccountId: string;
  details: { iban?: string; name?: string; product?: string };
}

export interface ConnectionAccountsResponse {
  externalAccounts: ExternalAccount[];
  existingAutoAccounts: { id: string; name: string }[];
}

/** Elenca gli istituti bancari GoCardless disponibili in un paese. */
export function useInstitutionsQuery(country: string) {
  return useQuery({
    queryKey: ["gocardless", "institutions", country],
    queryFn: async (): Promise<Institution[]> => {
      const response = await fetch(`/api/gocardless/institutions?country=${country}`);
      if (!response.ok) throw new Error("Impossibile caricare gli istituti");
      return response.json();
    },
    enabled: country.length > 0,
  });
}

/** Stato delle connessioni bancarie dell'utente, per i badge "Riconnetti". */
export function useBankConnectionsStatusQuery() {
  return useQuery({
    queryKey: ["gocardless", "connections", "status"],
    queryFn: async (): Promise<BankConnectionStatus[]> => {
      const response = await fetch("/api/gocardless/connections");
      if (!response.ok) throw new Error("Impossibile caricare lo stato delle connessioni");
      return response.json();
    },
  });
}

/** Crea una connessione GoCardless e restituisce il link di consenso a cui reindirizzare. */
export function useCreateConnectionMutation() {
  return useMutation({
    mutationFn: async (input: CreateConnectionInput): Promise<{ link: string }> => {
      const response = await fetch("/api/gocardless/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.error ?? "Impossibile avviare il collegamento");
      }
      return response.json();
    },
  });
}

/** Conti esterni trovati dopo il consenso, per la pagina di selezione. */
export function useConnectionAccountsQuery(connectionId: string) {
  return useQuery({
    queryKey: ["gocardless", "connections", connectionId, "accounts"],
    queryFn: async (): Promise<ConnectionAccountsResponse> => {
      const response = await fetch(`/api/gocardless/connections/${connectionId}/accounts`);
      if (!response.ok) throw new Error("Impossibile caricare i conti trovati");
      return response.json();
    },
  });
}

/** Finalizza la selezione dei conti da importare/ricollegare. */
export function useFinalizeConnectionMutation(connectionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: FinalizeSelectionInput) => {
      const response = await fetch(`/api/gocardless/connections/${connectionId}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.error ?? "Impossibile completare il collegamento");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["gocardless", "connections", "status"] });
    },
  });
}

export class SyncNotAvailableError extends Error {
  constructor(public readonly info: SyncErrorInfo) {
    super("Sync non disponibile");
  }
}

/** Avvia un sync manuale per un conto: mostra un toast con l'esito e invalida conti/transazioni/stato connessioni. */
export function useSyncAccountMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (accountId: string): Promise<SyncSuccessResult> => {
      const response = await fetch(`/api/gocardless/accounts/${accountId}/sync`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new SyncNotAvailableError(body);
      return body as SyncSuccessResult;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["gocardless", "connections", "status"] });
      toast.success(buildSyncSummaryMessage(result));
    },
    onError: (error: unknown) => {
      const info: SyncErrorInfo = error instanceof SyncNotAvailableError ? error.info : { status: "unknown" };
      toast.error(buildSyncErrorMessage(info));
    },
  });
}
