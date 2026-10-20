# 0001 — Native apps in two repos, one shared spec

Date: 2026-10-18 · Status: accepted

## Context
BuddyBudget is a Next.js web app. We want iOS and Android apps with *exactly* the same
experience, while each feels native and performs well.

## Decision
- iOS: Swift 6 + SwiftUI, iOS 17 minimum (Observation framework, Swift Charts).
- Android: Kotlin + Jetpack Compose (Material 3, customised to BuddyBudget tokens), minSdk 26.
- Two separate repos (`buddy-budget-ios`, `buddy-budget-android`), no shared code module.
- Parity is guaranteed by a third repo, `buddy-budget-mobile-spec`, holding requirements
  with stable IDs, the API contract, golden test vectors, design tokens and string catalogs.
- All three repos are private under `Mario2414` until launch; can be transferred later.

## Alternatives considered
- Kotlin Multiplatform: less duplicated logic, but couples the repos and adds a third
  build system. Revisit if duplicated domain logic grows beyond the simulators.
- Flutter / React Native: one codebase, but contradicts the "two native apps" goal.

## Consequences
- Business logic stays on the server where possible; only interactive simulators are
  ported, guarded by shared golden vectors.
- Every feature costs two implementations; the spec and fixtures keep them honest.
- Licensing for App Store / Play distribution must be decided before going public
  (the web app is AGPL-3.0, which is known to conflict with App Store terms).
