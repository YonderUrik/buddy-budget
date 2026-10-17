/**
 * components/domain/shared — barrel file
 *
 * Componenti trasversali riusati da più schermate (controlli, stati di errore, suggerimenti).
 */

export { SegmentedControl } from "./segmented-control";
export type { SegmentedControlOption, SegmentedControlProps } from "./segmented-control";
export { InfoHint } from "./info-hint";
export type { InfoHintProps } from "./info-hint";
export { LoadError } from "./load-error";
export type { LoadErrorProps } from "./load-error";
export { PageError } from "./page-error";
export type { PageErrorProps } from "./page-error";
export { ProgressBar } from "./progress-bar";
export type { ProgressBarProps, ProgressBarState } from "./progress-bar";
export { CollapsibleSection, COLLAPSIBLE_STORAGE_PREFIX } from "./collapsible-section";
export type { CollapsibleSectionProps } from "./collapsible-section";
export { SectionTabs, isSectionTabActive, activeSectionTabIndex } from "./section-tabs";
export type { SectionTab, SectionTabsProps } from "./section-tabs";
export { useStepFlow, StepProgress, StepStage, StepHeading, StepActions } from "./step-flow";
export type { UseStepFlowResult, StepProgressProps, StepStageProps, StepHeadingProps, StepActionsProps } from "./step-flow";
export type { StepDirection } from "./step-flow.state";
export { EmptyState } from "./empty-state";
export type { EmptyStateAction, EmptyStateProps } from "./empty-state";
export { FormDialogContent } from "./form-dialog";
export type { FormDialogContentProps, FormDialogSize } from "./form-dialog";
export { InlineOrSheet } from "./inline-or-sheet";
export type { InlineOrSheetLayout, InlineOrSheetProps } from "./inline-or-sheet";
export { BackLink } from "./back-link";
export { BackHistoryRecorder } from "./back-history-recorder";
export type { BackLinkProps } from "./back-link";
export { SectionHeading } from "./section-heading";
export type { SectionHeadingProps } from "./section-heading";
export { SectionViewsSheet } from "./section-views-sheet";
export type { SectionViewsSheetProps } from "./section-views-sheet";
export { LogoCredit } from "./logo-credit";
export type { LogoCreditProps } from "./logo-credit";
