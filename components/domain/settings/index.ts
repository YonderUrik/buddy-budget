/**
 * components/domain/settings — barrel file
 *
 * Sezioni della pagina Impostazioni (profilo, preferenze, sessioni, dati, zona pericolosa) e pannelli riusabili
 * per la verifica d'identità e lo stato "account disattivato".
 */

export { ProfileSection } from "./profile-section";
export type { ProfileSectionProps } from "./profile-section";
export { PreferencesSection } from "./preferences-section";
export type { PreferencesSectionProps } from "./preferences-section";
export { SessionsSection } from "./sessions-section";
export { DataSection } from "./data-section";
export type { DataSectionProps } from "./data-section";
export { PrivacySection } from "./privacy-section";
export type { PrivacySectionProps } from "./privacy-section";
export { DangerZoneSection } from "./danger-zone-section";
export type { DangerZoneSectionProps } from "./danger-zone-section";
export { ReauthPanel } from "./reauth-panel";
export type { ReauthPanelProps } from "./reauth-panel";
export { DeactivatedAccountPanel } from "./deactivated-account-panel";
export type { DeactivatedAccountPanelProps } from "./deactivated-account-panel";
export { SettingsSection, SettingsRow } from "./settings-section";
export type { SettingsSectionProps } from "./settings-section";
export { useRecentLogin } from "./use-recent-login";
