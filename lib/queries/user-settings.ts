"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UserDataSummary } from "@/lib/account/lifecycle";
import type { UserSessionView } from "@/lib/account/sessions";
import { REAUTH_REQUIRED_CODE } from "@/lib/account/constants";
import type { HomePagePath } from "@/lib/account/home-pages";
import type { UpdateUserSettingsInput } from "@/lib/validation/user-settings";
import type { SupportedCurrency } from "@/lib/validation/currency";

export type { UserDataSummary, UserSessionView };

/** Profilo e preferenze come li restituisce `GET /api/user/settings`. */
export interface UserSettings {
  name: string;
  email: string;
  image: string | null;
  currency: SupportedCurrency;
  homePage: HomePagePath;
  hideAmounts: boolean;
  /** Quando e quale versione di Termini e Privacy ha accettato (null se mai). */
  legalAcceptedAt: string | null;
  legalAcceptedVersion: string | null;
  createdAt: string;
  googleLinked: boolean;
  /** Fino a quando le azioni sensibili non chiedono di accedere di nuovo. */
  recentLoginUntil: string;
}

const SETTINGS_KEY = ["user-settings"] as const;
const SESSIONS_KEY = ["user-sessions"] as const;
const SUMMARY_KEY = ["user-data-summary"] as const;

/** Errore di una richiesta di gestione account: `reauthRequired` se serve un accesso recente. */
export class AccountActionError extends Error {
  reauthRequired: boolean;
  constructor(message: string, reauthRequired: boolean) {
    super(message);
    this.name = "AccountActionError";
    this.reauthRequired = reauthRequired;
  }
}

async function failure(response: Response, fallback: string): Promise<AccountActionError> {
  const body = (await response.json().catch(() => null)) as { error?: string; code?: string } | null;
  return new AccountActionError(body?.error ?? fallback, body?.code === REAUTH_REQUIRED_CODE);
}

/** `fetch` che trasforma sia gli errori HTTP sia quelli di rete in `AccountActionError`. */
async function request(url: string, init: RequestInit | undefined, fallback: string): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new AccountActionError("Connessione non riuscita. Controlla la rete e riprova.", false);
  }
  if (!response.ok) throw await failure(response, fallback);
  return response;
}

async function getJson<T>(url: string, fallback: string): Promise<T> {
  return (await request(url, undefined, fallback)).json() as Promise<T>;
}

/** Profilo, preferenze e stato dell'accesso recente. */
export function useUserSettingsQuery() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: () => getJson<UserSettings>("/api/user/settings", "Impossibile caricare le impostazioni"),
  });
}

/** Aggiorna nome, valuta o pagina iniziale. Invalida anche i dati che mostrano importi (la valuta cambia la formattazione). */
export function useUpdateUserSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, AccountActionError, UpdateUserSettingsInput>({
    mutationFn: async (input: UpdateUserSettingsInput) => {
      await request(
        "/api/user/settings",
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) },
        "Impossibile salvare le impostazioni"
      );
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

/** Sessioni attive dell'utente. */
export function useUserSessionsQuery() {
  return useQuery({
    queryKey: SESSIONS_KEY,
    queryFn: () => getJson<UserSessionView[]>("/api/user/sessions", "Impossibile caricare le sessioni"),
  });
}

/** Chiude una sessione (`id`) oppure, senza id, tutte le altre sessioni. */
export function useRevokeSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, AccountActionError, string | undefined>({
    mutationFn: async (id?: string) => {
      const url = id ? `/api/user/sessions/${encodeURIComponent(id)}` : "/api/user/sessions";
      await request(url, { method: "DELETE" }, "Impossibile chiudere la sessione");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SESSIONS_KEY }),
  });
}

/** Riepilogo dei dati posseduti (solo conteggi). */
export function useUserDataSummaryQuery() {
  return useQuery({
    queryKey: SUMMARY_KEY,
    queryFn: () => getJson<UserDataSummary>("/api/user/data-summary", "Impossibile caricare il riepilogo dei dati"),
  });
}

/** Scarica lo ZIP con tutti i dati e lo salva sul dispositivo. */
export function useExportDataMutation() {
  return useMutation<void, AccountActionError, void>({
    mutationFn: async () => {
      const response = await request("/api/user/export", undefined, "Esportazione non riuscita");
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const fileName = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "buddybudget-export.zip";
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    },
  });
}

async function send(url: string, method: "POST" | "DELETE", body: unknown, fallback: string): Promise<Response> {
  return request(
    url,
    { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) },
    fallback
  );
}

/** Reset completo dei dati (conferma con la parola richiesta). */
export function useResetAccountMutation() {
  return useMutation<void, AccountActionError, string>({
    mutationFn: async (confirmation: string) => {
      await send("/api/user/reset", "POST", { confirmation }, "Reset non riuscito");
    },
  });
}

/** Disattiva l'account: restituisce la data di eliminazione definitiva. */
export function useDeactivateAccountMutation() {
  return useMutation<{ deletionScheduledAt: string }, AccountActionError, void>({
    mutationFn: async () => {
      const response = await send("/api/user/deactivate", "POST", undefined, "Disattivazione non riuscita");
      return (await response.json()) as { deletionScheduledAt: string };
    },
  });
}

/** Riattiva un account disattivato. */
export function useReactivateAccountMutation() {
  return useMutation<void, AccountActionError, void>({
    mutationFn: async () => {
      await send("/api/user/reactivate", "POST", undefined, "Riattivazione non riuscita");
    },
  });
}

/** Elimina subito e per sempre l'account (conferma con l'email dell'account). */
export function useDeleteAccountMutation() {
  return useMutation<void, AccountActionError, string>({
    mutationFn: async (email: string) => {
      await send("/api/user/account", "DELETE", { email }, "Eliminazione non riuscita");
    },
  });
}
