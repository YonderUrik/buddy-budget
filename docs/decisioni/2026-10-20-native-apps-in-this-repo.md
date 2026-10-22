# Native iOS and Android apps live in this repo (2026-10-20)

**Decision**: the native apps and their shared spec move from three private repos into `mobile/`: `mobile/spec` (feature inventory, API contract, domain rules with golden vectors, design tokens, strings), `mobile/ios` (SwiftUI + BuddyBudgetKit) and `mobile/android` (Compose + `:core`). They are released under this repo's licence (AGPL-3.0).
**Layout**: the apps used the spec as a git submodule at `spec/`; here `mobile/ios/spec` and `mobile/android/spec` are symlinks to `../spec`, so build scripts and tests keep the same paths. The web toolchain and the Docker build context ignore `mobile/` (tsconfig, ESLint, Vitest, `.dockerignore`).
**Scope**: the apps ship only what the web shows (spec decision 0004) and use the mobile API endpoints already on `main` (#470, #472, #480).
**Open**: App Store distribution under AGPL-3.0 needs a check before release; CI for the apps is not set up yet.
