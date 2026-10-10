import "server-only";

/**
 * lib/notifications/server — barrel file (solo server)
 *
 * Preferenze, disiscrizione firmata e giro del cron delle email non di servizio.
 */

export { createUnsubscribeToken, verifyUnsubscribeToken, unsubscribePageUrl, unsubscribeApiUrl } from "./token";
export type { UnsubscribePayload } from "./token";
export { getNotificationPreferences, saveNotificationPreferences, applyUnsubscribe, claimKeys, releaseKeys, countRecentTests } from "./store";
export { runNotifications, parseNotificationsMode, databaseDeps } from "./run";
export type { NotificationsMode, NotificationsResult, NotificationDeps, NotificationUser } from "./run";
export { digestEmail, budgetAlertEmail, deadlineAlertEmail, NOTIFICATION_SETTINGS_PATH } from "./emails";
export type { BuiltEmail, EmailContext } from "./emails";
export { buildDigest, digestPeriod, digestWindowStartIso } from "./digest";
export { sendNotificationEmail } from "./send";
