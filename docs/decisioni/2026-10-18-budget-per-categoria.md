# 2026-10-18 — Budget per category: set again from the category

- **Problem**: the monthly budget of a category could only be typed in the legend of the old spending donut. When Conti and Movimenti became Liquidità (#186, 2026-10-08) the donut stopped being used, so no screen let users set or change a budget, while Panoramica, the budget alert emails and the summary kept reading it. The removal was not a decision: it is not in `2026-10-08-liquidita.md`.
- **Decision**: the budget lives with the category. Its detail window (Liquidità → Categorie, expense groups only) has «Budget al mese»: saved on blur, empty field removes it (`DELETE /api/budgets/[categoryId]`). The board tile shows «420 €/mese»; in Analisi each budgeted category's bar fills against its budget for the period, with what is left or how much it went over, and «Dove vanno i soldi» links to the categories.
- **Removed**: the unused donut (`CategoryBreakdownDonut`) and its helpers.
- **Deferred**: a dedicated Budget section (still needs its own brainstorming, see CLAUDE.md "Planned").
