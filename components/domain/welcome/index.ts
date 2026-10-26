/**
 * components/domain/welcome — barrel file
 *
 * «Dall'ultima visita»: the label beside the Panoramica date for a returning user (what happened while away, what
 * waits), and the visit heartbeat that decides when a visit starts.
 */

export { VisitHeartbeat } from "./visit-heartbeat";
export { WelcomeChip } from "./welcome-chip";
export type { WelcomeChipProps } from "./welcome-chip";
export { WELCOME_HREFS, happenedLine, waitingLine, welcomeLabel } from "./welcome-lines";
export type { WelcomeLine } from "./welcome-lines";
