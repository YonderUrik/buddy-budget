# Roadmap

Target: feature parity with the web app (871 requirements in `features/`), shipped
identically on iOS and Android. Each phase ends with a build on TestFlight and Play
internal testing; a phase is closed only when `PARITY.md` is green on **both** platforms.

Three tracks run in parallel in every phase:
**Backend** (PRs in `buddy-budget`), **iOS**, **Android**. Backend work for phase N+1
starts while apps build phase N.

## Phase 0 — Foundations
Goal: both apps can sign in a real user against the real backend and render correct
strings, numbers and colours.

- Backend
  - R1 `bearer()` plugin · R7 public `GET /api/legal` + coded 403s in `proxy.ts` · R8 bearer exempt from manual Origin checks (`api/auth.md`)
  - `GET /api/me/bootstrap`: onboarding state, legal version, deactivation, country, language, currency, capabilities (G1, G13)
  - Stable error `code`s on JSON errors (G15b), starting with auth and onboarding
- Spec tooling (`scripts/` here)
  - String catalog export from `lib/localization/catalogs` → `strings/catalog.json` → `Localizable.xcstrings` / `strings.xml` (+ `L10n` accessors)
  - `design/tokens.json` → Swift / Kotlin theme code; bundle the three fonts
- Apps
  - `BBFormat` on both platforms, passing all formatting vectors
  - Session store (Keychain / Keystore), `ApiClient` with bearer auth and both money encodings
  - Design system v1: `StatCard`, `AmountText`, buttons, inputs, list rows, bottom sheet, empty/error states
- Accounts: Apple Developer Program, Google Play Console, bundle id `io.buddybudget.app`

## Phase 1 — Sign-in and app shell
- Backend: R2 email OTP · R3 Google native client IDs · R4 Sign in with Apple · AASA / assetlinks
- Apps: `AUTH-*` sign-in, onboarding (country, language, currency), legal acceptance,
  deactivated account · `SHELL-*` tab bar + "More" navigation, country gating, global job
  indicator · `SET-*` profile, sessions, language, theme, sign-out, data export, delete account
- Exit: internal testers can sign in with email, Google and Apple on both platforms

## Phase 2 — Daily money (MVP → closed beta)
- Backend: `GET /api/overview` (G2) · `GET /api/liquidity/month` (G3) · paginated, filterable transactions (G4) · account sparkline + connection health (G5) · localized category names (G11) · R6 native GoCardless return
- Apps: `OV-*` Overview · `TX-*` Movements (list, filters, add/edit, Dividi) · `ACC-*` accounts and bank linking · `CAT-*` categories, rules, AI suggestions · `SUB-*` subscriptions
- Exit: **closed beta** — a user can live in the app day to day without opening the web

## Phase 3 — Wealth
- Backend: investments view + performance series (G7/G7b) · taxes & dividends (G8) · `POST /api/investments/taxes/simulate-sale` · pension view (G10) · debts interest shares (G12)
- Apps: `INV-*` investments · `SEC-*` securities & watchlist · net-worth history · `DEBT-*` debts with ported simulators · `PEN-*` pension with ported exit-tax timeline and projections

## Phase 4 — Insights, planning, imports
- Backend: analytics base (G9) · server-side CSV/XLSX parsing for personal imports · DE planning results · what's new (G14)
- Apps, one stream at a time:
  - 4a `ANA-*` Analitiche incl. Monte Carlo and "e se…" (ported) · `GOAL-*` goals wizard (IT only)
  - 4b `PLAN-001…031` Germany: Tax and Income screens in Investimenti (replace the DE placeholders); hidden German pension/retirement/simulators are out of scope (decision 0004)
  - 4c `IMP-*` broker and personal imports via the system file picker / share sheet, plus the Pensione file import and template
  - 4d `SUP-*` help & support
  - 4e Catch-up with the current web `main`: diff the web since the inventory, update `features/`, port the changes to both apps

## Phase 4R — Design & UX refresh (after Phase 4 implementation, before Phase 5) — done 2026-10-20 (web `0.81.0`, see `design/refresh-4R.md`)
Owner decision 2026-10-19: once all features are implemented, bring both apps to the **current web design and UX**.
The spec and design system were inventoried from web `0.69.1` (2026-10-16); the web was redesigned since
(#405 navy brand, brand yellow, tall titles, Sofia Sans Condensed display + Hanken headings, Space Grotesk/Geist Mono dropped;
#427 new headings and quiet lists across app screens) plus UX changes (guided start after onboarding, tap-to-open transaction
detail, no Liquidità badge in navigation, amounts fully hidden by «Nascondi gli importi», reworked «Primi passi»).
- Re-export `design/tokens.json`, fonts and icons from the current web; regenerate Tokens.swift / Tokens.kt (both apps change at once)
- Update `design/components.md` and each `features/*.md` screen description against the current web, screen by screen
- Restyle shared design-system components first, then every screen; side-by-side checks against the web as well as iOS ↔ Android
- Port remaining UX changes not covered by 4e; pin the web version the refresh was taken from in `CHANGELOG.md`
- Rule from here on: every phase starts by diffing the web since the last pinned version

## Phase 5 — Launch hardening → public release
- Accessibility audit (Dynamic Type / font scale, VoiceOver / TalkBack), performance, offline read cache, app-switcher privacy, store listings and screenshots, licence decision, make repos public (optional)
- Exit: **public release** on App Store and Google Play

## Decisions needed (blocking marked ●)
- ● Licence for the apps (AGPL conflicts with App Store terms) — before public repos/release
- ● Who owns the backend changes in `buddy-budget` and the Apple/Google developer accounts
- ● Approve ADR 0002 (server view endpoints) — shapes all of Phase 2–4
- Scope rule: mobile ships only what the web shows today (decision 0004); push notifications dropped until the web has them
- Budgets editable on mobile? Debt rename/costs editing? (`features/README.md`)
- Default of «Lascia che l'app scelga quando è quasi certa»
- Mobile adaptations marked "Proposal — needs product sign-off" (swipe-to-delete + undo, bottom sheet, chart touch, haptics)
- Web bugs found during the inventory: fix on web first, or ship the correct behaviour only on mobile?
