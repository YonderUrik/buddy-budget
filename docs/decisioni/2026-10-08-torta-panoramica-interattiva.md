# Net worth pie in Panoramica (Overview): restrained labels and interaction

- The label in the centre of the pie was too large compared with the rest of the page: it is now smaller (`text-2xl` + `text-xs`), with the same typographic classes as the rows beside it.
- On mouse hover (or focus on the row) the slice is highlighted, the others dim and the centre shows name, amount and share. On click/tap the slice stays locked (a second click unlocks it): on touch there is no hover, so tapping is the only way to read the numbers.
- The legend beside it is lighter: rows separated by thin lines instead of boxes, amounts in small type, dimmed arrow.
- Pie and rows are linked both ways; the rows remain links to the sections, no filter or navigation from the slice.
- The `NetWorthCompositionRow` component is used only by the Panoramica (the pie in Movimenti > Analisi is another component, unchanged).
- Umami event `overview_composition_slice_selected` (asset class only) when a slice is locked. No new API, metric or dependency.
