# Changelog

## v0.1.0 — unreleased
- **Design & UX refresh complete (Phase 4R): both apps match web `0.81.0` (`origin/main` `9a769fa5`)** — tokens and fonts
  re-exported (part 1), every screen hand-tuned at phone width (part 2): section headings as views, yellow main actions,
  no rules between rows, `SimulationResult` answers, the shared `PeriodSelector` (month grid in Analitiche), the Liquidità
  hero chart (TX-009…011) and «+ Conto» tile. Status and accepted differences: `design/refresh-4R.md`. Next phase starts by
  diffing web `main` from `9a769fa5`.
- **Web pin: `0.81.0` (`origin/main` `9a769fa5`, 2026-10-20)** — Phase 4e functional catch-up (decision 0004: only what
  web `main` shows). Added: movement detail (TX-063…076), «Messe dall'app» as a 30-day history with bank categories and
  the 70% threshold (CAT-097…101, budgets editable), «Primi passi» with focus, skips, next step and progress toasts
  (OV-044…048, AUTH-058, SHELL-058…060), «Dall'ultima visita» (`api/endpoints/welcome.md`), chart refresh notes,
  Liquidità without accounts, imports already present (IMP-062/063), held instruments and masked quantities
  (INV-111/112), goals menu, source icons and emergency spending (GOAL-036/037), returning account and language chooser
  (AUTH-059/060), AI usage summary (SET-050). Removed: SHELL-016/017 badge, CAT-081 «Va tutto bene», the demo offer
  block. Out of scope: IMP-049…054 (not on web `main`). Visual changes of the same period: `design/refresh-4R.md`.
- Initial spec: feature inventory from web app `0.69.1` (`433ae49c`), API contract,
  domain rules with golden vectors, design tokens, architecture conventions.
- API (backend branch `feat/mobile-api-foundations`): native email-code sign-in documented in `api/auth.md` §3.1;
  new `api/endpoints/overview.md` and `api/endpoints/liquidity.md`; paged transactions, account extras, localized
  categories and stable error codes in the endpoint docs and README §5–§7; G2–G5, G11, G15b marked implemented in
  `api/gaps.md`; response fixtures in `api/fixtures/`.
