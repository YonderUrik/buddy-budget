/**
 * components/domain/sync — barrel file
 *
 * Pannello globale di avanzamento dei job di sincronizzazione bancaria.
 */

export { SyncProgressIndicator } from "./sync-progress-indicator";
export { SyncProgressPanel } from "./sync-progress-panel";
export type { SyncProgressPanelProps } from "./sync-progress-panel";
export { SyncAccountProgressRow } from "./sync-account-progress-row";
export type { SyncAccountProgressRowProps } from "./sync-account-progress-row";
export { describeAccountProgress, describeJobTitle } from "./describe-account-progress";
export type { AccountProgressDescription } from "./describe-account-progress";
