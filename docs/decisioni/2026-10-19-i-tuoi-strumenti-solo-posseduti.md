# «I tuoi strumenti» lists only instruments held today

Date: 2026-10-19

Daniele saw titles that were not his under «I tuoi strumenti» in Investimenti. No data from other users was involved: every query behind those lists is filtered by user. The list came from every instrument with an operation (and, in «Cerca un titolo», also target-only ones), so sold-out positions and allocation targets showed up as if held.

Decision: the suggestions of «Cerca un titolo», «Registra operazione» and the target allocation dialog show only instruments with a quantity above zero today (`heldInstruments` in `lib/investments/view.ts`). Watched titles stay in «Seguiti» and in the Titoli tab; sold and watched titles are still found by typing, under «Già aggiunti».
