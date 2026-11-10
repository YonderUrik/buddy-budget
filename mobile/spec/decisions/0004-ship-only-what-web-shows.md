# 0004 — Mobile ships only what the web shows today

Date: 2026-10-19 · Status: accepted (owner decision)

## Decision
The mobile apps implement only features that a web user can reach today. Anything present in the web
code but hidden — behind a rollout switch, a route block, or dead code — is **out of scope** until the
web exposes it. When the web turns a feature on, it comes back into scope with a spec PR.

## Effects
- **PLAN (Germany):** only the Tax and Income screens (`tax`, `income` switches on) are in scope.
  PLAN-032…039 (pensions, AVD, net pension, retirement, all simulators) are out of scope. PLAN-004 is
  reduced to "hide what the web hides"; no runtime switches are built on mobile.
- **Country gating (updated 2026-10-21, web #465 / `0.85.0`):** outside Italy only **Pensione** (kept in «Altro»
  dimmed with «Presto», opening the country-unavailable screen) and the Italian investment **Tasse** tab (left out
  where the country has no tax rules) are closed. **Germany now shows Analitiche and Obiettivi** (before tax, like
  every country without Italian rules) and keeps its German Tax and Income screens (PLAN-003 for their subpaths).
  The new product country **`OTHER` («Altro paese»)** gets everything that does not depend on local rules: Dividendi,
  Analitiche, goals and FIRE run before tax (no capital gains tax, withholding or stamp duty; tax-only cards,
  toggles and fields hidden). The apps follow `GET /api/me/bootstrap` `capabilities` (web `isCountryPathAvailable` /
  `countryFeatures`) and keep no copy of the country matrix. Previously (2026-10-19): Pensione, Analitiche and
  Obiettivi hidden for DE.
- **Push notifications:** not built (the web lists them as «Presto»). Owner confirmed 2026-10-19. Supersedes the Phase 5 item in decision 0003.
- Legacy/dead web components (e.g. old `expenses/` and `cashflow/` charts, `/style-guide`) are not ported.
- The spec follows the **current web `main`**: when the web ships changes, a catch-up pass updates
  `features/` and the apps (see ROADMAP Phase 4e).
