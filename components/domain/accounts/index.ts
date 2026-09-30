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
export { CurrencyInput } from "./currency-input";
export type { CurrencyInputProps } from "./currency-input";
export { AccountsTrend, buildTrendPoints } from "./accounts-trend";
export type { AccountsTrendProps } from "./accounts-trend";
export { groupAccounts, MANUAL_GROUP_KEY, UNKNOWN_BANK_LABEL } from "./accounts-grouping";
export type { AccountGroup } from "./accounts-grouping";
