/**
 * components/domain/categorization — barrel file
 *
 * Punto di ingresso unico per i componenti della pagina di revisione categorizzazione (`/categorizza`)
 * e per la gestione delle regole in `/categorie`.
 */

export { CategorizeGroupRow } from "./categorize-group-row";
export type { CategorizeGroupRowProps } from "./categorize-group-row";
export { AutoOriginBadge, ORIGIN_ICONS, SuggestionOrigin } from "./suggestion-origin";
export type { AutoOriginBadgeProps, SuggestionOriginProps } from "./suggestion-origin";
export { MerchantLogo } from "./merchant-logo";
export type { MerchantLogoProps, MerchantLogoSize } from "./merchant-logo";
export { MovementsPreview } from "./movements-preview";
export type { MovementsPreviewProps } from "./movements-preview";
export { LogoCredit } from "./logo-credit";
export type { LogoCreditProps } from "./logo-credit";
export { RulesManager } from "./rules-manager";
export type { RulesManagerProps } from "./rules-manager";
export { RuleRow } from "./rule-row";
export type { RuleRowProps } from "./rule-row";
export { AddRuleForm } from "./add-rule-form";
export type { AddRuleFormProps } from "./add-rule-form";
export { CategorizeSwipeDeck } from "./swipe-deck";
export type { CategorizeSwipeDeckProps } from "./swipe-deck";
export { CategorizeListView } from "./categorize-list-view";
export type { CategorizeListViewProps } from "./categorize-list-view";
export { AutoCategorizedList } from "./auto-categorized-list";
export type { AutoCategorizedListProps } from "./auto-categorized-list";
export { AutoCategorizedRow } from "./auto-categorized-row";
export type { AutoCategorizedRowProps } from "./auto-categorized-row";
export { AutoApplyPrompt } from "./auto-apply-prompt";
export type { AutoApplyPromptProps } from "./auto-apply-prompt";
export { useAutoCategorization, appliedToastText } from "./use-auto-categorization";
export type { UseAutoCategorizationOptions } from "./use-auto-categorization";
export { useAiGeneration } from "./use-ai-generation";
export type { UseAiGenerationOptions } from "./use-ai-generation";
export { AiProgressStrip, AiSuggestBanner } from "./ai-suggest-banner";
export type { AiProgressStripProps, AiSuggestBannerProps } from "./ai-suggest-banner";
