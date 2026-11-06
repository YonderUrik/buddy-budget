"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { track } from "@/lib/analytics";
import { SYNC_JOBS_QUERY_KEY } from "./sync-jobs";
import type { IbkrFlexConnectionView } from "@/lib/ibkr-flex/connections";

export type { IbkrFlexConnectionView };
export const IBKR_FLEX_QUERY_KEY = ["ibkr-flex", "connections"] as const;
const BASE = "/api/ibkr-flex/connections";

export interface IbkrFlexState {
  open: boolean;
  configured: boolean;
  connections: IbkrFlexConnectionView[];
}

/** Why a connect or sync request was refused: the server's closed reason, plus the Flex sections it misses. */
export class IbkrFlexRequestError extends Error {
  constructor(public readonly reason: string, public readonly sections: string[] = []) { super(reason); this.name = "IbkrFlexRequestError"; }
}

/** Connections and availability; refreshed by the sync panel when a job ends. */
export function useIbkrFlexConnections() {
  return useQuery({
    queryKey: IBKR_FLEX_QUERY_KEY,
    queryFn: async (): Promise<IbkrFlexState> => {
      const response = await fetch(BASE, { cache: "no-store" });
      if (!response.ok) throw new IbkrFlexRequestError("unavailable");
      return response.json();
    },
    staleTime: 30_000,
  });
}

/** Connect (or reconnect) with a Flex token and query id; the token is sent once and never kept in the cache. */
export function useConnectIbkrFlex() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { token: string; queryId: string }): Promise<{ connectionId: string; reconnected: boolean; jobId: string | null }> => {
      const response = await fetch(BASE, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new IbkrFlexRequestError(typeof body.reason === "string" ? body.reason : "unavailable", Array.isArray(body.sections) ? body.sections : []);
      return body;
    },
    // The variables hold the token: drop them from the mutation cache as soon as it settles.
    gcTime: 0,
    onSuccess: (result) => {
      track("ibkr_flex_connected", { reconnected: result.reconnected });
      void client.invalidateQueries({ queryKey: IBKR_FLEX_QUERY_KEY });
      void client.invalidateQueries({ queryKey: SYNC_JOBS_QUERY_KEY });
    },
    onError: (error) => track("ibkr_flex_connect_failed", { reason: error instanceof IbkrFlexRequestError ? error.reason : "unavailable" }),
  });
}

/** Start a manual sync; progress shows in the global sync panel. */
export function useSyncIbkrFlex() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (connectionId: string) => {
      const response = await fetch(`${BASE}/${connectionId}/sync`, { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new IbkrFlexRequestError(typeof body.status === "string" ? body.status : "unavailable");
      return body as { jobId: string };
    },
    onSuccess: () => { track("ibkr_flex_sync_started"); void client.invalidateQueries({ queryKey: SYNC_JOBS_QUERY_KEY }); },
    onSettled: () => client.invalidateQueries({ queryKey: IBKR_FLEX_QUERY_KEY }),
  });
}

/** Remove the connection and its token (imported history stays). */
export function useDisconnectIbkrFlex() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (connectionId: string) => {
      const response = await fetch(`${BASE}/${connectionId}`, { method: "DELETE" });
      if (!response.ok) throw new IbkrFlexRequestError("unavailable");
    },
    onSuccess: () => { track("ibkr_flex_disconnected"); void client.invalidateQueries({ queryKey: IBKR_FLEX_QUERY_KEY }); },
  });
}
