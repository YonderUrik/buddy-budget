/**
 * components/domain/notifications — barrel file
 *
 * Pagina pubblica di disiscrizione dalle email di riepilogo e avviso e scelta delle email nell'onboarding. La sezione di Impostazioni sta in
 * `components/domain/settings` (NotificationsSection).
 */

export { UnsubscribeCard } from "./unsubscribe-card";
export type { UnsubscribeCardProps } from "./unsubscribe-card";
export { InvalidUnsubscribe } from "./invalid-unsubscribe";
export { NotificationChoices } from "./notification-choices";
export type { NotificationChoicesProps } from "./notification-choices";
export { InboxPreview } from "./inbox-preview";
export type { InboxPreviewProps } from "./inbox-preview";
export { inboxPreview, PREFERENCE_FIELD_BY_KIND, DIGEST_FREQUENCY_OPTIONS, ONBOARDING_NOTIFICATION_INFO } from "./notification-choices.data";
export type { InboxPreviewItem } from "./notification-choices.data";
