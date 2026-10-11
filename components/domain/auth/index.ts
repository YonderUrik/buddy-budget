/**
 * components/domain/auth — barrel file
 *
 * Componenti delle pagine di autenticazione e onboarding.
 */

export { AuthSheet } from "./auth-sheet";
export type { AuthSheetProps } from "./auth-sheet";
export { AuthSheetTable } from "./auth-sheet-table";
export type { AuthSheetTableProps } from "./auth-sheet-table";
export { buildAuthSheetTabs } from "./auth-sheet.data";
export type { AuthSheetRow, AuthSheetTab, AuthSheetTabId } from "./auth-sheet.data";
export { useSheetFormula } from "./auth-sheet-formula";
export type { SheetFormula } from "./auth-sheet-formula";
export { LOGIN_AREAS } from "./login-areas.data";
export type { LoginArea } from "./login-areas.data";
export { UPCOMING_FEATURES } from "./upcoming-features.data";
export type { UpcomingFeature } from "./upcoming-features.data";
export { BrandLink } from "./brand-link";
export type { BrandLinkProps } from "./brand-link";
export { LoginPanel } from "./login-panel";
export type { LoginPanelProps } from "./login-panel";
export { CurrencyPicker } from "./currency-picker";
export type { CurrencyPickerProps } from "./currency-picker";
export { GoogleIcon } from "./google-icon";
export { LegalLinksNote } from "./legal-links-note";
export type { LegalLinksNoteProps } from "./legal-links-note";
export { LegalConsentFields } from "./legal-consent-fields";
export type { LegalConsentFieldsProps } from "./legal-consent-fields";
export { LegalAcceptancePanel } from "./legal-acceptance-panel";
export type { LegalAcceptancePanelProps } from "./legal-acceptance-panel";
export { useLegalConsent } from "./use-legal-consent";
export type { LegalConsentState } from "./use-legal-consent";
