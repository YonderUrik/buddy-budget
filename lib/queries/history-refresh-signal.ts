"use client";

/**
 * Tab-wide mark "an import or sync just finished, the history charts are reloading". Set where imports and syncs
 * end, read by `useChartRefreshState`. No imports, so both sides can use it without a dependency cycle.
 */

let pendingSince: number | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** Call when a file import or bank sync has finished and its data queries have been invalidated. */
export function markHistoryRefreshPending(): void {
  pendingSince = Date.now();
  emit();
}

export function clearHistoryRefreshPending(): void {
  if (pendingSince === null) return;
  pendingSince = null;
  emit();
}

export function subscribeHistoryRefresh(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function historyRefreshPendingSince(): number | null {
  return pendingSince;
}
