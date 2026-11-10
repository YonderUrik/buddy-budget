# 0003 — Product defaults adopted while open questions are pending

Date: 2026-10-18 · Status: accepted (provisional — revisit when product decides)

Implementation continues without waiting on the open product questions. These defaults are
applied identically on iOS and Android; each can be changed later with a spec PR.

| Question | Default adopted | Why |
|---|---|---|
| Editable budgets on mobile? | ~~No~~ **Yes since web #432 (2026-10-19)**: «Budget al mese (facoltativo)» in the category detail (CAT-099…101, `PUT`/`DELETE /api/budgets/{categoryId}`), bars against the budget in Analisi (TX-074) | Web is the reference (README rule 7) and now edits budgets |
| Debt rename / costs editing? | No — same as web | Same |
| Deletes | Confirmation dialog where the web has one; where the web deletes immediately, swipe-to-delete with an **Undo** snackbar (5 s) before the API call is sent | Safer than web, identical on both platforms |
| Web bugs found in the inventory | Mobile implements the **correct** behaviour; each bug is listed in `features/README.md` for a web fix | Don't copy known bugs into two more codebases |
| Bottom sheet, chart touch, haptics | Proposals in `design/components.md` and `design/charts.md` are adopted as-is | Needed to build UI; cheap to change |
| Sign-in methods | Email code (OTP) first; Google and Apple after client IDs exist | Native Google/Apple need console setup by the owner |
| Push notifications | Out of scope (superseded by 0004: not built until the web has them) | No backend yet |
| App licence | None (private repos) until the owner decides | AGPL vs App Store conflict |
