/**
 * components/domain/categories — barrel file
 *
 * Punto di ingresso unico per i componenti di gestione categorie.
 */

export { CategoryAvatar, ICON_MAP } from "./category-avatar";
export type { CategoryAvatarProps } from "./category-avatar";
export { CategoryBoard } from "./category-board";
export type { CategoryBoardProps } from "./category-board";
export { DistributeColorsButton } from "./distribute-colors-button";
export { CategoryPicker } from "./category-picker";
export type { CategoryPickerProps } from "./category-picker";
export { CategorySheet } from "./category-sheet";
export type { CategorySheetProps } from "./category-sheet";
export { CategorySetupSummary } from "./category-setup-summary";
export type { CategorySetupSummaryProps } from "./category-setup-summary";
export { CategorySetupSheet } from "./category-setup-sheet";
export type { CategorySetupSheetProps } from "./category-setup-sheet";
export { useCategorySetup } from "./use-category-setup";
export type { UseCategorySetupResult } from "./use-category-setup";
export { CategorySetupStep } from "./category-setup-step";
export type { CategorySetupStepProps } from "./category-setup-step";
