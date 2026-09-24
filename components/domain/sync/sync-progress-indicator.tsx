"use client";

import { useDismissSyncJobMutation, useInvalidateOnSyncJobFinish, useSyncJobsQuery } from "@/lib/queries/sync-jobs";
import { SyncProgressPanel } from "./sync-progress-panel";

/** Contenitore del pannello: legge i job, aggiorna i dati a fine job e gestisce la chiusura. Va montato una sola volta nel layout. */
export function SyncProgressIndicator() {
  const { data: jobs } = useSyncJobsQuery();
  const dismiss = useDismissSyncJobMutation();
  useInvalidateOnSyncJobFinish(jobs);

  return <SyncProgressPanel jobs={jobs ?? []} onDismiss={(jobId) => dismiss.mutate(jobId)} />;
}
