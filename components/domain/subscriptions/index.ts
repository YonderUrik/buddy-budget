/**
 * components/domain/subscriptions — barrel file
 *
 * Abbonamenti (Liquidità): schermata, righe, dialog di dettaglio e di aggiunta.
 */

export { SubscriptionsOverview } from "./subscriptions-overview";
export type { SubscriptionsOverviewProps } from "./subscriptions-overview";
export { SubscriptionRow } from "./subscription-row";
export type { SubscriptionRowProps } from "./subscription-row";
export { SubscriptionDetailDialog } from "./subscription-detail-dialog";
export type { SubscriptionDetailDialogProps } from "./subscription-detail-dialog";
export { AddSubscriptionDialog } from "./add-subscription-dialog";
export type { AddSubscriptionDialogProps } from "./add-subscription-dialog";
export { daysBetween, fromDate, initialOf, itemHint, onDate, reasonSentence, whenPhrase } from "./subscriptions-format";
