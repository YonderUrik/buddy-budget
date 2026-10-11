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
export { ProgressBar } from "./progress-bar";
export type { ProgressBarProps, ProgressBarState } from "./progress-bar";
export { CollapsibleSection, COLLAPSIBLE_STORAGE_PREFIX } from "./collapsible-section";
export type { CollapsibleSectionProps } from "./collapsible-section";
export { SectionTabs, isSectionTabActive, activeSectionTabIndex } from "./section-tabs";
export type { SectionTab, SectionTabsProps } from "./section-tabs";
export { EmptyState } from "./empty-state";
export type { EmptyStateAction, EmptyStateProps } from "./empty-state";
