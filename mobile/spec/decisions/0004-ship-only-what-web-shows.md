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
- **DE gating:** Pensione, Analitiche and Obiettivi stay hidden for DE, with deep links to the
  country-unavailable screen (PLAN-003), exactly as on the web.
- **Push notifications:** not built (the web lists them as «Presto»). Owner confirmed 2026-10-19. Supersedes the Phase 5 item in decision 0003.
- Legacy/dead web components (e.g. old `expenses/` and `cashflow/` charts, `/style-guide`) are not ported.
- The spec follows the **current web `main`**: when the web ships changes, a catch-up pass updates
  `features/` and the apps (see ROADMAP Phase 4e).
