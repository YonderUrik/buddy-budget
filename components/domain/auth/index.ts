/**
 * components/domain/auth — barrel file
 *
 * Componenti delle pagine di autenticazione e onboarding.
 */

export { AuthFrame } from "./auth-frame";
export { AUTH_PRIMARY_BUTTON, AUTH_TITLE } from "./auth-styles";
export type { AuthFrameProps } from "./auth-frame";
export { AuthPreview } from "./auth-preview";
export type { AuthPreviewProps } from "./auth-preview";
export { AuthFootLinks } from "./auth-foot-links";
export { BrandLink } from "./brand-link";
export type { BrandLinkProps } from "./brand-link";
export { LoginPanel } from "./login-panel";
export { LoginScreen } from "./login-screen";
export type { LoginPanelProps } from "./login-panel";
export { PasswordLoginPanel } from "./password-login-panel";
export type { PasswordLoginMode, PasswordLoginPanelProps } from "./password-login-panel";
export { PasswordForgotPanel, RESET_PASSWORD_COMMAND } from "./password-forgot-panel";
export type { PasswordForgotPanelProps } from "./password-forgot-panel";
export { PasswordResetPanel } from "./password-reset-panel";
export { AuthField } from "./auth-field";
export type { AuthFieldProps } from "./auth-field";
export { usePasswordActions, describePasswordError, PASSWORD_RESET_PAGE_PATH } from "./use-password-actions";
export type { PasswordActions } from "./use-password-actions";
export { RememberReturningUser } from "./remember-returning-user";
export type { RememberReturningUserProps } from "./remember-returning-user";
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
