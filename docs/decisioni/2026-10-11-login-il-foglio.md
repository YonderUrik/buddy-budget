# 2026-10-11 — «Il foglio» ("The sheet") sign-in page

Daniele found the login (sample net worth with chart, PR #232/#236) already seen. Among three directions he chose «Il foglio», which continues the landing's opening: the sign-in pages are a spreadsheet, with a formula bar (`=ACCEDI("email")` while typing), numbered columns and rows, the email as selected cell B6 and tabs at the bottom («Cosa c'è dentro», «Novità», «In arrivo» — "What's inside", "What's new", "Coming soon") that change the table on the right. What's new and coming soon come from the `lib/features` catalog, so they are not updated by hand.

Components in `components/domain/auth` (`AuthSheet`, `AuthSheetTable`, `useSheetFormula`); removed `LoginHorizon`, mosaic, «In arrivo» ticker and the what's-new note. New `--highlight` token (highlighter) and Umami event `login_sheet_tab_selected`.

Postponed: own formula for onboarding and acceptance of the Terms (today `=BENVENUTO()`), test on Safari/iPhone.
