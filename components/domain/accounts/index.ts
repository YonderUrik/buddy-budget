/**
 * components/domain/accounts — barrel file
 *
 * Punto di ingresso unico per i componenti della schermata Conti.
 */

export { AccountsKpi } from "./accounts-kpi";
export type { AccountsKpiProps } from "./accounts-kpi";
export { computeAccountsKpi } from "./accounts-kpi.utils";
export type { AccountsKpiResult } from "./accounts-kpi.utils";
export { AccountRow } from "./account-row";
export type { AccountRowProps } from "./account-row";
export { AddAccountForm } from "./add-account-form";
