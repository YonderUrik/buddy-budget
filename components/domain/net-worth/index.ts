/**
 * components/domain/net-worth — barrel file
 *
 * Punto di ingresso unico per i componenti della schermata Panoramica.
 */

export { NetWorthPeriodSelector } from "./net-worth-period-selector";
export type { NetWorthPeriodSelectorProps } from "./net-worth-period-selector";
export { NetWorthChartCard } from "./net-worth-chart-card";
export type { NetWorthChartCardProps } from "./net-worth-chart-card";
export { NetWorthChartTooltip } from "./net-worth-chart-tooltip";
export type { NetWorthChartTooltipProps } from "./net-worth-chart-tooltip";
export { NetWorthCompositionRow } from "./net-worth-composition-row";
export type { NetWorthCompositionRowProps } from "./net-worth-composition-row";
export { buildCompositionItems, computeInvestedShare, MARKET_HIGHLIGHT_LABEL } from "./net-worth-composition-row.utils";
export type { CompositionHighlight, DebtsComposition, InvestmentsComposition, NetWorthCompositionItem, PensionComposition } from "./net-worth-composition-row.utils";
export {
  ASSET_CLASS_COLORS,
  ASSET_CLASS_LABELS,
  ASSET_CLASS_ORDER,
  assetClassColor,
  assetClassLabel,
  assetClassesInSeries,
  FALLBACK_ASSET_CLASS_COLOR,
} from "./asset-classes";
