/**
 * components/domain/categorization — barrel file
 *
 * Punto di ingresso unico per i componenti della pagina di revisione categorizzazione (`/categorizza`)
 * e per la gestione delle regole in `/categorie`.
 */

export { CategorizeGroupRow } from "./categorize-group-row";
export type { CategorizeGroupRowProps } from "./categorize-group-row";
export { SuggestionSourceBadge } from "./suggestion-source-badge";
export type { SuggestionSourceBadgeProps } from "./suggestion-source-badge";
export { RulesManager } from "./rules-manager";
export type { RulesManagerProps } from "./rules-manager";
export { RuleRow } from "./rule-row";
export type { RuleRowProps } from "./rule-row";
export { AddRuleForm } from "./add-rule-form";
export type { AddRuleFormProps } from "./add-rule-form";
export { CategorizeSwipeDeck } from "./swipe-deck";
export type { CategorizeSwipeDeckProps } from "./swipe-deck";
export { CategorizeListView } from "./categorize-list-view";
export { AiProgressStrip, AiSuggestBanner } from "./ai-suggest-banner";
export type { AiProgressStripProps, AiSuggestBannerProps } from "./ai-suggest-banner";
