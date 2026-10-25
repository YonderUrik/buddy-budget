"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateConnectionInput, FinalizeSelectionInput } from "@/lib/validation/gocardless";
import { buildSyncErrorMessage } from "@/lib/gocardless/sync-messages";
import type { SyncErrorInfo } from "@/lib/gocardless/sync-messages";
import { SYNC_JOBS_QUERY_KEY } from "@/lib/queries/sync-jobs";
import { track } from "@/lib/analytics";
import { errorToast } from "@/lib/support/request-report";
import { useLocalization } from "@/lib/localization/provider";
import type { CapacityBlockReason } from "@/lib/gocardless/capacity";
import { pageText } from "@/lib/localization/page-text";

/** Risposta di `GET /api/gocardless/capacity`. */
export interface CapacityStatus {
  canConnectNew: boolean;
  reason: CapacityBlockReason | null;
  renewableInstitutionIds: string[];
  /** Already asked to be told when new connections open. */
  interested: boolean;
}

export interface Institution {
  id: string;
  name: string;
  transaction_total_days: string;
  logo?: string;
}

export interface BankConnectionStatus {
  provider?: "gocardless" | "trade-republic";
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

export const BANK_CAPACITY_QUERY_KEY = ["gocardless", "capacity"] as const;

/** Se l'utente può collegare una banca nuova (posti e limite per persona) e quali banche può rinnovare. */
export function useBankCapacityQuery(enabled = true) {
  return useQuery({
    queryKey: BANK_CAPACITY_QUERY_KEY,
    queryFn: async (): Promise<CapacityStatus> => {
      const response = await fetch("/api/gocardless/capacity");
      if (!response.ok) throw new Error(pageText("Impossibile verificare i collegamenti disponibili"));
      return response.json();
    },
    enabled,
  });
}

/** «Tienimi aggiornato» (`interested: true`) or «Non avvisarmi più» (`false`) while new bank connections are closed. */
export function useBankInterestMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (interested: boolean): Promise<{ interested: boolean }> => {
      const response = await fetch("/api/bank-connection-interest", { method: interested ? "POST" : "DELETE" });
      if (!response.ok) throw new Error(pageText("Impossibile salvare la richiesta, riprova"));
      return response.json();
    },
    onSuccess: ({ interested }) => {
      track(interested ? "bank_connect_interest_registered" : "bank_connect_interest_withdrawn");
      queryClient.setQueryData<CapacityStatus>(BANK_CAPACITY_QUERY_KEY, (current) => (current ? { ...current, interested } : current));
    },
  });
}

/** Elenca gli istituti bancari GoCardless disponibili in un paese. */
export function useInstitutionsQuery(country: string) {
  return useQuery({
    queryKey: ["gocardless", "institutions", country],
    queryFn: async (): Promise<Institution[]> => {
      const response = await fetch(`/api/gocardless/institutions?country=${country}`);
      if (!response.ok) throw new Error(pageText("Impossibile caricare gli istituti"));
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
      const responses = await Promise.all([fetch("/api/gocardless/connections"), fetch("/api/trade-republic/connections")]);
      if (responses.some(response => !response.ok)) throw new Error(pageText("Impossibile caricare lo stato delle connessioni"));
      const [openBanking, tradeRepublic] = await Promise.all(responses.map(response => response.json()));
      return [...openBanking, ...tradeRepublic];
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
        throw new Error(errorBody?.error ?? pageText("Impossibile avviare il collegamento"));
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
      if (!response.ok) throw new Error(pageText("Impossibile caricare i conti trovati"));
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
        throw new Error(errorBody?.error ?? pageText("Impossibile completare il collegamento"));
      }
      return response.json();
    },
    onSuccess: (_result, input) => {
      track("bank_connect_completed", { accounts: input.selections.length });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["gocardless", "connections", "status"] });
      queryClient.invalidateQueries({ queryKey: BANK_CAPACITY_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: SYNC_JOBS_QUERY_KEY });
    },
  });
}

export class SyncNotAvailableError extends Error {
  constructor(public readonly info: SyncErrorInfo) {
    super(pageText("Sync non disponibile"));
  }
}

/** Avvia un sync manuale come job in background; l'avanzamento compare nel pannello globale. Gli errori immediati vanno in un toast. */
export function useSyncAccountMutation(provider: "gocardless" | "trade-republic" = "gocardless") {
  const queryClient = useQueryClient();
  const { locale } = useLocalization();
  return useMutation({
    mutationFn: async (accountId: string): Promise<{ jobId: string }> => {
      const response = await fetch(`/api/${provider}/accounts/${accountId}/sync`, { method: "POST" });
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
      errorToast(buildSyncErrorMessage(info, locale), "sync_banca");
      // Un 409 "già in sincronizzazione" segnala un job in corso avviato altrove: aggiorna il pannello.
      queryClient.invalidateQueries({ queryKey: SYNC_JOBS_QUERY_KEY });
    },
  });
}
