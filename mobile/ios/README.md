# BuddyBudget — iOS

Native iOS app for [BuddyBudget](https://buddybudget.io), built with Swift 6 and SwiftUI (iOS 17+).
Behaviour, copy and design are defined in the shared spec
([`buddy-budget-mobile-spec`](https://github.com/Mario2414/buddy-budget-mobile-spec), submodule at `spec/`);
the Android app ([`buddy-budget-android`](https://github.com/Mario2414/buddy-budget-android)) implements the same spec.

## Layout
| Path | What |
|---|---|
| `BuddyBudgetKit/` | Swift package: Domain + Data (API client, DTOs, simulators, formatters). No UI dependency. |
| `BuddyBudget/` | SwiftUI app: App, Features, DesignSystem, Resources |
| `project.yml` | XcodeGen definition (the `.xcodeproj` is generated, not committed) |

## Getting started
Requires Xcode 26+ and [XcodeGen](https://github.com/yonaskolb/XcodeGen) (`brew install xcodegen`).
```sh
git clone --recurse-submodules git@github.com:Mario2414/buddy-budget-ios.git
cd buddy-budget-ios
(cd BuddyBudgetKit && swift test)
xcodegen generate && open BuddyBudget.xcodeproj
```
Debug builds talk to `http://localhost:3000/`, i.e. `pnpm dev` of the web repo.

## Working on a feature
1. Find the requirement IDs in `spec/features/`.
2. Implement, and name tests after the IDs (`TX004_splitUpdatesEffectiveSpend`).
3. Update `spec/PARITY.md` in a spec PR and bump the `spec` submodule here.
4. Reference the IDs in the PR description: `Implements: TX-004`.
