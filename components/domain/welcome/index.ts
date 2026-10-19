/**
 * components/domain/welcome — barrel file
 *
 * «Dall'ultima visita» on Panoramica (what happened while away, what waits for the user) and the visit heartbeat.
 */

export { WelcomeSection } from "./welcome-section";
export type { WelcomeSectionProps } from "./welcome-section";
export { WelcomeSummary } from "./welcome-summary";
export type { WelcomeSummaryProps } from "./welcome-summary";
export { VisitHeartbeat } from "./visit-heartbeat";
export { WELCOME_HREFS, happenedLine, sinceLabel, waitingLine } from "./welcome-lines";
export type { WelcomeFormatters, WelcomeLine } from "./welcome-lines";
