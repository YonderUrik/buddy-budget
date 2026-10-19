/**
 * Visits: the app layout sends a heartbeat while the app is open; a gap longer than `VISIT_GAP_MS` since the last one
 * starts a new visit, and the end of the previous visit becomes the point the «Dall'ultima visita» toast counts from.
 * Pure rules here; the atomic database update is in `visit.server.ts`.
 */

/** A pause longer than this starts a new visit (the usual length of an analytics session). */
export const VISIT_GAP_MS = 30 * 60 * 1000;
/** Heartbeats closer than this do not write to the database. */
export const VISIT_TOUCH_THROTTLE_MS = 60 * 1000;
/** How often the open app sends a heartbeat while the tab is visible. */
export const VISIT_HEARTBEAT_MS = 5 * 60 * 1000;

export interface VisitState {
  appSeenAt: Date | null;
  visitStartedAt: Date | null;
  visitSinceAt: Date | null;
  welcomeShownAt: Date | null;
}

/** State after a heartbeat at `now` (the same rule as the SQL in `touchVisit`, kept here to be tested). */
export function nextVisitState(state: VisitState, now: Date): { state: VisitState; newVisit: boolean } {
  const { appSeenAt } = state;
  if (appSeenAt && now.getTime() - appSeenAt.getTime() < VISIT_TOUCH_THROTTLE_MS) return { state, newVisit: false };
  const newVisit = !appSeenAt || now.getTime() - appSeenAt.getTime() > VISIT_GAP_MS;
  return {
    newVisit,
    state: {
      ...state,
      appSeenAt: now,
      visitStartedAt: newVisit ? now : state.visitStartedAt,
      // The very first heartbeat has no previous visit to count from.
      visitSinceAt: newVisit && appSeenAt ? appSeenAt : state.visitSinceAt,
    },
  };
}

/** The toast was already shown during the current visit. */
export function isWelcomeShown(state: Pick<VisitState, "visitStartedAt" | "welcomeShownAt">): boolean {
  return Boolean(state.welcomeShownAt && state.visitStartedAt && state.welcomeShownAt >= state.visitStartedAt);
}

/** True when the toast has something to say. */
export function hasWelcomeContent(summary: { happened: readonly unknown[]; waiting: readonly unknown[] }): boolean {
  return summary.happened.length > 0 || summary.waiting.length > 0;
}
