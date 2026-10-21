# BuddyBudget — Mobile Spec

Single source of truth for the **BuddyBudget native apps**:

| Platform | Repo | Stack |
|---|---|---|
| iOS | [`buddy-budget-ios`](https://github.com/Mario2414/buddy-budget-ios) | Swift 6, SwiftUI, iOS 17+ |
| Android | [`buddy-budget-android`](https://github.com/Mario2414/buddy-budget-android) | Kotlin, Jetpack Compose, minSdk 26 |
| Web (reference + backend) | [`buddy-budget`](https://github.com/YonderUrik/buddy-budget) | Next.js, better-auth, Postgres |

The goal is **identical behaviour and look on iOS and Android**. Platform conventions
(navigation gestures, system sheets, share sheet, haptics) are respected, but every screen,
flow, rule, number and string is defined **once, here**, and implemented in both apps.

## Layout

| Path | What it defines |
|---|---|
| [`features/`](features/) | Every screen and flow, as atomic requirements with stable IDs (`OV-001`, `TX-004`, …) |
| [`api/`](api/) | Backend contract: endpoints, auth, data model, enums, known gaps |
| [`domain/`](domain/) | Calculations both apps must reproduce exactly, with golden test vectors |
| [`design/`](design/) | Design tokens (`tokens.json`), components, charts, icons |
| [`platform/`](platform/) | Shared architecture conventions both codebases follow |
| [`decisions/`](decisions/) | Architecture decision records (ADR) |
| [`PARITY.md`](PARITY.md) | Feature × platform status matrix |
| [`ROADMAP.md`](ROADMAP.md) | Long-term plan, phases and milestones |
| [`CHANGELOG.md`](CHANGELOG.md) | Spec versions |

## Rules of the game

1. **Spec first.** A behaviour change starts as a PR here. Code PRs in the app repos
   reference the requirement IDs they implement (`Implements: TX-004, TX-005`).
2. **Stable IDs.** Requirement IDs are never reused or renumbered. A removed requirement
   is marked `~~Removed in vX.Y~~`, not deleted.
3. **Versioned.** The spec is tagged (`v0.1.0`, …). Each app includes this repo as a git
   submodule at `spec/`; the pinned commit is the spec version it implements.
4. **Parity is tracked, not assumed.** `PARITY.md` is updated in the same PR that ships a
   requirement on a platform. A feature is *done* only when it is done on both.
5. **Shared fixtures.** Golden vectors in `domain/` and JSON fixtures in `api/fixtures/`
   are consumed by the unit tests of both apps, so the same inputs must give the same outputs.
6. **Shared strings and tokens.** UI copy and design tokens are generated into each app
   from the files in this repo. Nobody hand-edits generated files.
7. **Web is the reference.** Unless a requirement says otherwise, behaviour matches the
   current web app. Mobile-only adaptations are marked *Mobile adaptation* and need sign-off.
