"use client";

import * as React from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { hasRunningImport } from "@/lib/personal-import/island";
import { runningJobIds } from "@/lib/sync-jobs/view";
import { chartRefreshState, isRefreshSettled, type ChartRefreshState } from "@/lib/net-worth/refresh-status";
import { clearHistoryRefreshPending, historyRefreshPendingSince, subscribeHistoryRefresh } from "./history-refresh-signal";
import { usePersonalImportsQuery } from "./personal-imports";
import { useSyncJobsQuery } from "./sync-jobs";

/** A finished import whose chart never reloads (no chart on screen, request lost) stops counting after this long. */
const PENDING_MAX_AGE_MS = 2 * 60_000;

/**
 * What a history chart should tell the user about imported data: "importing" while a file import or bank sync runs,
 * "updating" from its end until `query` (the chart's data) has been reloaded, null otherwise. Both polls it reads are
 * already running in the layout (import island, sync panel), so this adds no requests.
 */
export function useChartRefreshState(query: Pick<UseQueryResult, "dataUpdatedAt" | "errorUpdatedAt" | "isFetching">): ChartRefreshState {
  const pending = React.useSyncExternalStore(subscribeHistoryRefresh, historyRefreshPendingSince, () => null);
  const imports = usePersonalImportsQuery();
  const syncs = useSyncJobsQuery();
  const importing = hasRunningImport(imports.data?.jobs) || runningJobIds(syncs.data).size > 0;
  // An error also ends the wait: the chart shows its own error state.
  const dataUpdatedAt = Math.max(query.dataUpdatedAt, query.errorUpdatedAt);
  const [mountedAt] = React.useState(() => Date.now());
  const pendingSince = pending !== null && mountedAt - pending < PENDING_MAX_AGE_MS ? pending : null;
  const input = { pendingSince, dataUpdatedAt, isFetching: query.isFetching };

  React.useEffect(() => {
    if (isRefreshSettled({ pendingSince, dataUpdatedAt, isFetching: query.isFetching })) clearHistoryRefreshPending();
  }, [pendingSince, dataUpdatedAt, query.isFetching]);

  return chartRefreshState({ importing, ...input });
}
