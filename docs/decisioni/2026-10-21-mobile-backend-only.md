# Mobile backend delivered separately (2026-10-21)

The mobile backend from PR #473 is delivered on its own branch, based on current main. Native projects and specifications, mobile build settings, and repository exclusions for those projects belong in separate PRs.

Scope: server-computed views using the web's existing calculation functions, opt-in transaction pagination and account/debt extras, metadata and release notes, localized categories, stable API error codes, and native GoCardless return/completion. The browser return page is part of the bank-link handoff. Shared helper extractions keep the web and API calculations aligned without changing the web's successful response formats. The existing bank capacity restrictions and country rules remain enforced.

Bearer sessions and email-code sign-in already shipped in #470 and #472. This split adds no schema migrations, dependencies, or environment variables. The production build fix keeps the AI-suggestion quota constant private to its route. No impact on the landing.
