/** components/domain/movements — barrel: stato condiviso, schede e blocchi propri della sezione Movimenti. */

export { MovementsProvider, useMovements, movementsFetchWindow, MOVEMENTS_ACCOUNT_PARAM } from "./movements-context";
export type { MovementsState } from "./movements-context";
export { MovementsKpiStrip } from "./movements-kpi-strip";
export type { MovementsKpiStripProps } from "./movements-kpi-strip";
export { MovementsTrendSwitch } from "./movements-trend-switch";
export type { MovementsTrendSwitchProps } from "./movements-trend-switch";
export { MOVEMENTS_TABS, MOVEMENTS_CATEGORIES_HREF, MOVEMENTS_MANAGEMENT_HREFS } from "./movements-nav";
export { AccountFilterChip } from "./account-filter-chip";
export type { AccountFilterChipProps } from "./account-filter-chip";
