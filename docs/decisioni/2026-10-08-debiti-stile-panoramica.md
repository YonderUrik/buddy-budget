# Debiti (Debts) in the Panoramica style

Date: 2026-10-08

Same work done for Investimenti (see `2026-10-08-investimenti-stile-panoramica.md`): the whole Debiti section adopts the standard style of Panoramica and Liquidità. Presentation only: no calculation, data, route, Umami event or migration changes.
`/debiti` page: header with total debt in `MoneyHero` (dimmed decimals) and the date you will be debt-free; two columns 3/5 + 2/5 from `lg` (Prossime rate and I tuoi debiti | Come uscirne prima and Dove paghi di più); page as wide as the Panoramica (`max-w-6xl`). Loan detail: no single box, but ring and remaining balance in `MoneyHero`, notice about instalments to confirm as a row with rules, «E se…» ("What if…") and log side by side, instalment plan full width; each part is an open section with a tinted icon (`PanelSection`, colours in `debts-theme.ts`).
Dialogs (add debt in two steps with `DialogSteps`, mark as paid, early repayment, rate change, balance correction): `PanelDialogHeader`, sub-sections with title (`DialogSection`) and footer with actions (`DialogActions`). The `AlertDialog` confirmations are unchanged.
Reuse: `PanelSection` and the dialog pieces still live in `components/domain/investments` (no shared component touched). When moving to a shared folder (with Pensione, which does the same work) it will be enough to move them. `DebtsListCard` no longer receives `totalDebt` (the total is in the header).
This PR is built on top of the Investimenti one (#184) because it uses its components: it must be merged after it.
