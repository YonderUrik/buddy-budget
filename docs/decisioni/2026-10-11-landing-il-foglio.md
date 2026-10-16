# Landing «Il foglio» ("The sheet") (2026-10-11)

Daniele chose direction C among three prototypes (A «Il quadro», B «Le domande», C «Il foglio» — "The picture", "The questions", "The sheet"): the home starts from an Excel sheet with `#VALORE!` that turns into the real Panoramica, and each area is «prima» ("before": the formula you used to write) versus «ora» ("now": the app screen).

- Style aligned with the app at Daniele's request: same neutrals, radii, fonts (Space Grotesk, Hanken Grotesk, Geist Mono) and buttons (solid primary, outlined secondary), pill tabs like the app's. From the sheet remain the grid paper of the opening, the monospace cells and the yellow of the selected cell.
- New sections: «Funziona con quello che usi già» ("Works with what you already use": logos of IBKR, DEGIRO, Trade Republic, Fineco, Yahoo; Open Banking countries), tabbed «Scheda tecnica» ("Technical sheet": bank, categories, brokers, risk, taxes, debts, what it doesn't do) with facts verified in the code, full catalog in a filterable table.
- Removed: questions at the opening, three steps, four groups, server map. Umami events `question_*` replaced by `sheet_view_toggled` and `detail_tab_selected`.
- Postponed: inner pages (/funzioni, /strumenti, /guide) take the app's fonts and buttons but keep their layout; Open Graph image to redo.
