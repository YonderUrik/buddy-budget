/** What a history chart should say while imported data is on its way into it. Pure logic, used by the chart hook. */

/** `importing`: a file import or bank sync is running; `updating`: it finished and the chart is reloading. */
export type ChartRefreshState = "importing" | "updating" | null;

export interface ChartRefreshInput {
  /** A personal import or bank sync of this user is still running. */
  importing: boolean;
  /** When an import or sync last finished (ms), until the chart has data newer than that; null otherwise. */
  pendingSince: number | null;
  /** When the chart's data was last received (TanStack Query `dataUpdatedAt`, ms; 0 before the first load). */
  dataUpdatedAt: number;
  isFetching: boolean;
}

export function chartRefreshState({ importing, pendingSince, dataUpdatedAt, isFetching }: ChartRefreshInput): ChartRefreshState {
  if (importing) return "importing";
  if (pendingSince !== null && (isFetching || dataUpdatedAt < pendingSince)) return "updating";
  return null;
}

/** True once the chart holds data received after the import finished: the pending mark can go. */
export function isRefreshSettled({ pendingSince, dataUpdatedAt, isFetching }: Omit<ChartRefreshInput, "importing">): boolean {
  return pendingSince !== null && !isFetching && dataUpdatedAt >= pendingSince;
}
