/**
 * components/domain/accounts — barrel file
 *
 * Punto di ingresso unico per i componenti della schermata Conti.
 */

export { AccountsKpi } from "./accounts-kpi";
export type { AccountsKpiProps } from "./accounts-kpi";
export { computeAccountsKpi } from "./accounts-kpi.utils";
export type { AccountsKpiResult } from "./accounts-kpi.utils";
export { AccountAvatar } from "./account-avatar";
export type { AccountAvatarProps } from "./account-avatar";
export { AccountIconColorPicker } from "./account-icon-color-picker";
export type { AccountIconColorPickerProps } from "./account-icon-color-picker";
export { AccountRow } from "./account-row";
export type { AccountRowProps } from "./account-row";
export { AddAccountForm } from "./add-account-form";
export type { AddAccountFormProps } from "./add-account-form";
export { ConnectBankFlow, BANK_COUNTRY_OPTIONS } from "./connect-bank-flow";
export type { ConnectBankFlowProps, FeaturedBank } from "./connect-bank-flow";
export { BankRow, GenericBankLogo, TradeRepublicLogo, BANK_ROW_CLASS } from "./bank-row";
export type { BankRowProps } from "./bank-row";
export { CurrencyInput } from "./currency-input";
export type { CurrencyInputProps } from "./currency-input";
export { AccountsTrend, buildTrendPoints } from "./accounts-trend";
export type { AccountsTrendProps } from "./accounts-trend";
export { groupAccounts, MANUAL_GROUP_KEY, UNKNOWN_BANK_LABEL } from "./accounts-grouping";
export type { AccountGroup } from "./accounts-grouping";
export { RenewalBanner } from "./renewal-banner";
export type { RenewalBannerProps } from "./renewal-banner";
export { buildRenewalAlerts, describeRenewalAlert } from "./renewal-alerts";
export type { RenewalAlert, RenewalSource } from "./renewal-alerts";
export { AccountDetailsDialog } from "./account-details-dialog";
export type { AccountDetailsDialogProps } from "./account-details-dialog";
export { localizedAccountStatus, buildAccountStatus, describeSyncAvailability, sumBalances } from "./account-status";
export type { AccountStatus, AccountSyncInfo } from "./account-status";
export { BankReturnCard } from "./bank-return-card";
export type { BankReturnCardProps } from "./bank-return-card";
