/** lib/welcome: the «Dall'ultima visita» summary on Panoramica (client-safe part: types and visit rules). */
export type {
  WelcomeHappened,
  WelcomeHappenedKind,
  WelcomeItemKind,
  WelcomeResponse,
  WelcomeSummary,
  WelcomeWaiting,
  WelcomeWaitingKind,
} from "./types";
export { VISIT_GAP_MS, VISIT_HEARTBEAT_MS, VISIT_TOUCH_THROTTLE_MS, hasWelcomeContent, isWelcomeDismissed, nextVisitState } from "./visit";
export type { VisitState } from "./visit";
