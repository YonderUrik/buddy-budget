# Investimenti (Investments) in the Panoramica style

Date: 2026-10-08

Daniele wants the redone Panoramica (Wealthfolio-inspired) as the product standard: Investimenti, all tabs, adopts it in groups of tabs, one PR per group. Presentation only: no calculation, data or route changes.
Rules of the visual language, reused from the Panoramica: a single full-width chart with a large amount (`MoneyHero`, dimmed decimals) and period selector centred below; the other parts are open sections without a box, with an icon tinted in the colour of their area (`SectionHeading`) and rows separated by rules; two columns from `lg` (3/5 + 2/5); page as wide as the Panoramica (`max-w-6xl`).
New `PanelSection` component (`components/domain/investments`) replacing `Card` + `CardTitle` in the tabs; `MoneyHero` is now exported from the `net-worth` barrel. All tabs (Portafoglio, Performance, Diversificazione, Dividendi, Tasse, Operazioni, Titoli and the security page) are in the same PR, because the session works on a single branch. Long tabs use two columns (3/5 + 2/5) from `lg`; the returns heatmap stays full width.
Postponed: «Gestisci importazioni» ("Manage imports", in Operazioni) and the dialogs remain as before.

## Dialogs

The Investimenti dialogs too (record/edit operation, 4-step import, manual price, benchmark, instrument settings, allocation targets, area/sector correction, import management and reset) follow the style: `PanelDialogHeader` (tinted icon + title + description), `DialogSections`/`DialogSection` for sub-sections, `DialogActions` for the footer with actions, `DialogSteps` for the import path (`components/domain/investments/dialog-parts.tsx`). Presentation only; the `AlertDialog` confirmations are unchanged.
