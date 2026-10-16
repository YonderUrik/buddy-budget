# Pensione (Pension) in the Panoramica style

Date: 2026-10-08

- The whole Pensione section (page, five tabs, form, CSV/Excel import dialog, empty state) adopts the standard style of Panoramica and Liquidità: large amount with dimmed decimals, full-width charts, open sections with tinted icon, no grey boxes.
- Reused `SectionTitle`, `MoneyHero` and `InfoHint`; the only new component is `PensionSection` (title + description + hint), so as not to repeat the same header in eight tabs. The ring and the summary cards are replaced by `PensionHero` and `PensionInsights`.
- In the import dialog each step is divided into sub-sections with the same title (Scegli il file, Colonne, Anteprima, Cosa cambia — "Choose the file, Columns, Preview, What changes").
- Presentation only: no change to calculations, data, Umami events, logs or migrations.
- Before/after screenshots in the project's `pensione-stile/` folder. Postponed: the «Aggiorna i valori» ("Update the values") form stays in the page (it does not become a dialog).
