"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SyncJobView } from "@/lib/sync-jobs/types";
import { hasFinishedSince, runningJobIds } from "@/lib/sync-jobs/view";

export const SYNC_JOBS_QUERY_KEY = ["sync-jobs"] as const;
export const SYNC_JOBS_POLL_INTERVAL_MS = 1000;

/** Query invalidate a fine job: i dati che un sync può aver cambiato. */
const QUERY_KEYS_CHANGED_BY_SYNC = [
  ["accounts"],
  ["transactions"],
  ["gocardless", "connections", "status"],
  ["net-worth-snapshots"],
] as const;

/** Job di sync dell'utente; interroga il server ogni secondo solo mentre almeno un job è in corso. */
export function useSyncJobsQuery() {
  return useQuery({
    queryKey: SYNC_JOBS_QUERY_KEY,
    queryFn: async (): Promise<SyncJobView[]> => {
      const response = await fetch("/api/sync-jobs");
      if (!response.ok) throw new Error("Impossibile leggere lo stato della sincronizzazione");
      return response.json();
    },
    refetchInterval: (query) => (runningJobIds(query.state.data).size > 0 ? SYNC_JOBS_POLL_INTERVAL_MS : false),
  });
}

/** Quando un job termina, aggiorna conti, movimenti e patrimonio. Da usare in un solo punto (il pannello globale). */
export function useInvalidateOnSyncJobFinish(jobs: SyncJobView[] | undefined): void {
  const queryClient = useQueryClient();
  const previous = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    const current = runningJobIds(jobs);
    if (hasFinishedSince(previous.current, current)) {
      for (const queryKey of QUERY_KEYS_CHANGED_BY_SYNC) {
        queryClient.invalidateQueries({ queryKey: [...queryKey] });
      }
    }
    previous.current = current;
  }, [jobs, queryClient]);
}

/** Chiude il riepilogo di un job concluso. */
export function useDismissSyncJobMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string): Promise<void> => {
      const response = await fetch(`/api/sync-jobs/${jobId}/dismiss`, { method: "POST" });
      if (!response.ok) throw new Error("Impossibile chiudere il riepilogo");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SYNC_JOBS_QUERY_KEY }),
  });
}
