"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CreateConnectionInput, FinalizeSelectionInput } from "@/lib/validation/gocardless";
import { buildSyncErrorMessage } from "@/lib/gocardless/sync-messages";
import type { SyncErrorInfo } from "@/lib/gocardless/sync-messages";
import { SYNC_JOBS_QUERY_KEY } from "@/lib/queries/sync-jobs";
import { track } from "@/lib/analytics";

export interface Institution {
  id: string;
  name: string;
  transaction_total_days: string;
  logo?: string;
}

export interface BankConnectionStatus {
  accountId: string;
  /** Connessione a cui appartiene il conto (più conti possono condividerla). */
  connectionId: string;
  /** Fine del consenso concesso alla banca (ISO), se nota. */
  consentExpiresAt: string | null;
  /** Nome della banca a cui appartiene il conto (per raggruppare la lista). */
  institutionName: string;
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
    onSuccess: () => track("bank_connect_started"),
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
    mutationFn: async (input: FinalizeSelectionInput): Promise<{ jobId: string }> => {
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
    onSuccess: (_result, input) => {
      track("bank_connect_completed", { accounts: input.selections.length });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["gocardless", "connections", "status"] });
      queryClient.invalidateQueries({ queryKey: SYNC_JOBS_QUERY_KEY });
    },
  });
}

export class SyncNotAvailableError extends Error {
  constructor(public readonly info: SyncErrorInfo) {
    super("Sync non disponibile");
  }
}

/** Avvia un sync manuale come job in background; l'avanzamento compare nel pannello globale. Gli errori immediati vanno in un toast. */
export function useSyncAccountMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (accountId: string): Promise<{ jobId: string }> => {
      const response = await fetch(`/api/gocardless/accounts/${accountId}/sync`, { method: "POST" });
      const body = await response.json().catch(() => ({ status: "unknown" }));
      if (!response.ok) throw new SyncNotAvailableError(body);
      return body as { jobId: string };
    },
    onSuccess: () => {
      track("account_sync_manual");
      queryClient.invalidateQueries({ queryKey: SYNC_JOBS_QUERY_KEY });
    },
    onError: (error: unknown) => {
      const info: SyncErrorInfo = error instanceof SyncNotAvailableError ? error.info : { status: "unknown" };
      toast.error(buildSyncErrorMessage(info));
      // Un 409 "già in sincronizzazione" segnala un job in corso avviato altrove: aggiorna il pannello.
      queryClient.invalidateQueries({ queryKey: SYNC_JOBS_QUERY_KEY });
    },
  });
}
