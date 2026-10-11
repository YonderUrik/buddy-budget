/**
 * Barrel leggero di Investimenti per la sidebar e le parti sempre caricate: espone solo ciò che non trascina i grafici
 * (Recharts). Chi sta in una pagina di Investimenti importa dal barrel completo (`./index`).
 */

export { formatSignedPct } from "./gain-text";
export { TitleSparkline } from "./titles/title-sparkline";
export { DialogActions, DialogSection, DialogSections, DialogSteps, PanelDialogHeader } from "./dialog-parts";
export { PanelSection } from "./panel-section";
