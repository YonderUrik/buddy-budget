/**
 * components/domain/analytics — barrel file
 *
 * Sezione Analitiche: cursori «e se…», guida iniziale e le quattro domande (con i dettagli tecnici di sei analisi).
 */

export { ANALYTICS_QUESTIONS } from "./analytics-questions";
export type { AnalyticsQuestion } from "./analytics-questions";
export { ScenarioView } from "./scenario-view";
export type { ScenarioViewProps } from "./scenario-view";
export { AssumptionsPanel } from "./assumptions-panel";
export type { AssumptionsPanelProps } from "./assumptions-panel";
export { WalkthroughDialog } from "./walkthrough-dialog";
export type { WalkthroughDialogProps } from "./walkthrough-dialog";
export { GuidedReading } from "./guided-reading";
export type { GuidedReadingProps } from "./guided-reading";
export type { ReadingStep } from "./guided-steps";
export { FireTab } from "./fire-tab";
export type { FireTabProps } from "./fire-tab";
export { SimulationTab } from "./simulation-tab";
export type { SimulationTabProps } from "./simulation-tab";
export { WithdrawalTab } from "./withdrawal-tab";
export type { WithdrawalTabProps } from "./withdrawal-tab";
export { GrowthTab } from "./growth-tab";
export type { GrowthTabProps } from "./growth-tab";
export { RiskTab } from "./risk-tab";
export type { RiskTabProps } from "./risk-tab";
export { CostsTab } from "./costs-tab";
export type { CostsTabProps } from "./costs-tab";
export { money, pct } from "./analytics-format";
export { Term } from "./term";
export type { TermProps } from "./term";
export { GLOSSARY } from "./glossary";
export type { GlossaryId } from "./glossary";
