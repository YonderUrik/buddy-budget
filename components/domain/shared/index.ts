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
