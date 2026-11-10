# Shared app architecture

Both apps use the same layers, names and responsibilities so a requirement maps to the
same place in either codebase. Names below are identical on both platforms.

```
App            entry point, DI container, root navigation, deep links
Features/<X>   one folder per feature area (Overview, Accounts, Transactions, …)
  <X>Screen    UI only — renders a UiState, forwards user intents
  <X>Model     state holder (iOS: @Observable class · Android: ViewModel + StateFlow)
Domain         pure logic: formatters, simulators, validation — no I/O, fully unit-tested
Data           API client, DTOs, repositories, session/token store, cache
DesignSystem   tokens (generated), typography, components (StatCard, AmountText, …)
Resources      generated strings, icons, assets
```

Domain + Data live in a module with no UI-framework dependency (iOS: Swift package
`BuddyBudgetKit`; Android: Gradle module `:core`, plain Kotlin/JVM), so they build and
run the shared golden tests on any machine and in CI without simulators.

Each app includes this spec repo as a **git submodule at `spec/`**. The pinned commit is
the spec version the app implements; tests read golden vectors and fixtures from it.

| Concern | iOS | Android |
|---|---|---|
| UI | SwiftUI | Jetpack Compose |
| State | `@Observable` models, `async/await` | `ViewModel` + `StateFlow`, coroutines |
| Navigation | `NavigationStack` + `TabView` | Navigation Compose + bottom bar |
| Networking | `URLSession` (`APIClient`) | OkHttp (`ApiClient`) |
| JSON | `Codable` | kotlinx.serialization |
| Secure storage | Keychain | EncryptedSharedPreferences / DataStore + Keystore |
| Charts | Swift Charts + custom `Canvas` shapes | custom Compose `Canvas` chart kit (see `design/charts.md`) |
| DI | manual container `AppEnvironment` | manual container `AppEnvironment` |
| Tests | Swift Testing + XCUITest | JUnit + Compose UI tests |
| Lint/format | SwiftFormat + SwiftLint | ktlint + detekt |

## Conventions
- **UiState is a value type** with the same fields on both platforms (`isLoading`,
  `error`, `content`). Loading / empty / error states are mandatory for every screen.
- **Numbers** are `Double` on both platforms, because the reference implementation is
  JavaScript: using `Decimal`/`BigDecimal` would make results *differ* from the web.
  Rounding follows the JS rules in `domain/README.md`. Money arrives from the API either
  as a string or a number (see `api/README.md`); decoders accept both.
- **Formatting** goes only through `BBFormat` (same name on both platforms), driven by
  `domain/locale-data/locale-data.json`, never through the platform's locale formatters
  directly — iOS, Android and the web ship different CLDR data.
- **Enums** mirror `api/data-model.md` verbatim, with an `unknown` fallback case so an
  older app survives a new server value.
- **Strings and tokens** come only from generated files (`scripts/` in this repo).
- **Requirement IDs** appear in test names (`test_TX004_splitUpdatesEffectiveSpend`)
  so parity can be checked by grepping both repos.
