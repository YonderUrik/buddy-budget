# BuddyBudget — Android

Native Android app for [BuddyBudget](https://buddybudget.io), built with Kotlin and Jetpack Compose.
Behaviour, copy and design are defined in the shared spec
([`buddy-budget-mobile-spec`](https://github.com/Mario2414/buddy-budget-mobile-spec), submodule at `spec/`);
the iOS app ([`buddy-budget-ios`](https://github.com/Mario2414/buddy-budget-ios)) implements the same spec.

## Modules
| Module | What | Needs Android SDK |
|---|---|---|
| `:core` | Domain + Data (API client, DTOs, simulators, formatters). Plain Kotlin/JVM. | no |
| `:app` | Compose UI, design system, navigation | yes |

## Getting started
```sh
git clone --recurse-submodules git@github.com:Mario2414/buddy-budget-android.git
./gradlew :core:test            # works with only a JDK 21
./gradlew :app:assembleDebug    # needs the Android SDK (Android Studio, or ANDROID_HOME)
```
Debug builds talk to `http://10.0.2.2:3000/`, i.e. `pnpm dev` of the web repo on the host machine.

## Working on a feature
1. Find the requirement IDs in `spec/features/`.
2. Implement, and name tests after the IDs (`TX004_splitUpdatesEffectiveSpend`).
3. Update `spec/PARITY.md` in a spec PR and bump the `spec` submodule here.
4. Reference the IDs in the PR description: `Implements: TX-004`.
