/**
 * components/domain/goals — barrel file
 *
 * Obiettivi di risparmio (vista Obiettivi di Analitiche, dettaglio, form a passi, sezione della Panoramica).
 * Nessun grafico: si può importare anche dalla Panoramica senza appesantirla.
 */

export { GOAL_KIND_INFO, FIRE_GOAL_INFO } from "./goal-kinds";
export type { GoalKindInfo } from "./goal-kinds";
export { goalFormatters, statusSentence, statusLabel, fireShiftText } from "./goal-format";
export type { GoalFormatters, Translate } from "./goal-format";
export { GoalsOverview } from "./goals-overview";
export type { GoalsOverviewProps } from "./goals-overview";
export { GoalsEmpty } from "./goals-empty";
export type { GoalsEmptyProps } from "./goals-empty";
export { GoalDetail } from "./goal-detail";
export type { GoalDetailProps } from "./goal-detail";
export { GoalFormDialog } from "./goal-form-dialog";
export type { GoalFormDialogProps } from "./goal-form-dialog";
export type { GoalFormStep } from "./goal-form-state";
export { GoalsPanoramicaSection, closestGoals, GOALS_INVITE_DISMISSED_KEY } from "./goals-panoramica-section";
export type { GoalsPanoramicaSectionProps } from "./goals-panoramica-section";
export { GoalRow } from "./goal-row";
export type { GoalRowProps } from "./goal-row";
export { useGoalActions } from "./goal-actions";
export type { GoalAction } from "./goal-actions";
export { useGoalFormatters } from "./use-goal-formatters";
export { DeleteGoalDialog } from "./delete-goal-dialog";
export type { DeleteGoalDialogProps } from "./delete-goal-dialog";
