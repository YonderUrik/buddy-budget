# Generators

These scripts turn the shared sources into the files both apps compile: strings (from the web
catalogs) and design tokens and fonts (from `design/`). They need Node ≥ 20 and have no
dependencies. Generated files start with a `GENERATED — do not edit` header that names the
script. Edit the source and re-run the scripts. Never edit generated files by hand.

## Run everything

```sh
node scripts/sync-all.mjs <ios-path> <android-path> [web-path]
# e.g. from this repo:
node scripts/sync-all.mjs ../buddy-budget-ios ../buddy-budget-android ../buddy-budget
```

- `web-path` defaults to `../buddy-budget` next to this repo. The web repo is **only read**.
- Add `--check` to write nothing. The script then exits with code 1 if any generated file is out of date. Use it in app CI.
- Output is deterministic: running the script twice gives byte-identical files. Unchanged files are not rewritten.
- In the app repos, `spec/` is this repo as a submodule, so app CI can run
  `node spec/scripts/sync-all.mjs . <other-app> --check`, or run the per-platform script directly.

| Step | Script | Reads | Writes |
|---|---|---|---|
| 1 | `export-strings.mjs [web]` | web `lib/localization/catalogs/{en,de}.json` + inline entries in `messages.ts` | `strings/catalog.json`; normalizes `strings/mobile.json` (fills `id`, `placeholders`) |
| 2 | `gen-strings-ios.mjs <ios>` | `strings/catalog.json` + `strings/mobile.json` | `BuddyBudget/Resources/Localizable.xcstrings`, `Resources/Generated/L10n.swift`, `Resources/Generated/LocalizedStrings.swift` |
| 3 | `gen-strings-android.mjs <android>` | same | `app/src/main/res/values{,-en,-de}/strings_generated.xml`, `app/src/main/kotlin/io/buddybudget/app/generated/{L10n,LocalizedStrings}.kt` |
| 4 | `gen-tokens.mjs <ios> <android>` | `design/tokens.json`, `design/fonts/` | iOS `BuddyBudget/DesignSystem/Generated/Tokens.swift`, `Resources/Fonts/*`. Android `app/src/main/kotlin/io/buddybudget/app/designsystem/generated/Tokens.kt`, `res/font/*.ttf`, `assets/licenses/*-OFL.txt` |
| 5 | `export-icons.mjs [web]` | web `lucide-react` imports in `app/ components/ lib/` (aliases resolved), `lib/validation/{accounts,categories}.ts`, `node_modules/lucide-react` icon nodes | `design/icons/lucide/*.svg`, `design/icons/icons.json`, `design/icons/LICENSE-lucide.txt` (skipped without a web checkout) |
| 6 | `gen-icons.mjs <ios> <android>` | `design/icons/` | iOS `BuddyBudget/Resources/Icons.xcassets/lucide-*.imageset` (template SVG), `DesignSystem/Generated/Icons.swift` (`enum BBIcon`), `Resources/Licenses/Lucide-ISC.txt`. Android `res/drawable/lucide_*.xml` (VectorDrawable), `designsystem/generated/Icons.kt` (`enum class BBIcon`), `assets/licenses/Lucide-ISC.txt` |
| — | `make-static-fonts.py` (Python + fontTools, run once) | `design/fonts/*[wght].ttf` | `design/fonts/static/*.ttf` |

Shared code lives in `lib/common.mjs` (file writing, headers, check mode) and `lib/strings.mjs` (ids,
placeholders, merging).

## Strings

The rules are in [`domain/formatting-localization.md`](../domain/formatting-localization.md) §4–5.

- **Canonical entry:** `{id, it, en, de, placeholders}`. The `id` is
  `snake(English, ≤ 40 chars)` + `_` + the first 6 hex characters of `sha1(Italian)`, for example
  `data_as_of_0_8edc5c`. The id stays stable while the Italian source stays the same. When the
  Italian source changes, the id changes, and the build breaks at every call site so each one gets
  reviewed. That is intentional. Id collisions and duplicate sources stop the export with an error.
- **Placeholders:** `{0}` or `{name}` are numbered in order of first appearance in the Italian text.
  On iOS they become `%N$@`; on Android they become `%N$s`. The exporter prints any entry whose
  placeholder set differs between languages, and also stores the list in
  `catalog.json → placeholderMismatches`.
- **Mobile-only strings** go in [`strings/mobile.json`](../strings/mobile.json). The format is the
  same, and the generators merge the file with the catalog. Add a string there only when the web
  never shows it. Otherwise add it to the web catalogs. `aliases` give friendly accessor names
  (`retry`, `appName`, …) to existing entries.
- **Escaping:** on iOS, every value escapes a literal `%` as `%%` and always goes through
  `String(format:)`. On Android:
  - `\`, `'`, `"`, newlines and tabs are escaped.
  - A leading `@` or `?` gets a backslash.
  - `&`, `<` and `>` become XML entities.
  - A literal `%` becomes `%%` in strings that have placeholders. Strings without placeholders keep a
    raw `%` and are marked `formatted="false"`.
  - Values with leading or trailing whitespace, or with runs of whitespace, are wrapped in `"…"` so
    aapt2 keeps them byte-exact.
- **Scale:** each catalog entry is one line in `catalog.json`, which keeps diffs readable. The Swift
  lookup index is two plain array literals, which type-check fast. The Kotlin index is split into
  objects of 250 entries each, so every method stays far below the JVM's 64 KB limit.

### Language follows the account, not the device

| | iOS | Android |
|---|---|---|
| Types | `AppLanguage` (`it`/`en`/`de`, `.resolve(language:productCountry:)`, `.locale`), `LocalizedStrings.shared` | `AppLanguage` (`IT`/`EN`/`DE`, `AppLanguage.resolve(language, productCountry)`, `.locale`), `LocalizedStrings` |
| Mechanism | Xcode compiles the `.xcstrings` file into `it/en/de.lproj`. `LocalizedStrings` loads the `.lproj` bundle of the account language and resolves every `L10n.*` accessor through it. | `values/` holds Italian, and `values-en/` and `values-de/` hold the translations. `LocalizedStrings` builds a `Resources` for the account locale with `createConfigurationContext`. |
| Switch | `LocalizedStrings.shared.setLanguage(.resolve(language: user.language, productCountry: user.productCountry))`. The class is `@Observable`, so SwiftUI bodies that read `L10n` re-render. | `ProvideLocalizedStrings(language) { … }` at the root. Pass the new language and the tree recomposes. The provider also overrides `LocalContext` and `LocalConfiguration`, so Material components follow the account language. |
| Read | `L10n.tryAgain`, `L10n.dataAsOf0(date)`, `L10n.retry` (alias) | `l10n(L10n.retry)`, `l10n(R.string.data_as_of_0_8edc5c, date)`. Prefer `l10n` over `stringResource`. |
| API labels in Italian | `L10n.lookup(italian: "Dovute")`, `L10n.lookup(italian: s, ["0": x])` | `LocalStrings.current.lookup("Dovute")`, `lookup(s, mapOf("0" to x))` |

Missing keys fall back to the Italian source, as on the web. Unknown `{name}` placeholders are left
as-is. Pass `AppLanguage.locale` to `BBFormat`.

## Icons

The rules are in [`design/iconography-assets.md`](../design/iconography-assets.md) §1.4. Decision: **Lucide SVGs →
iOS asset catalog (template, vector-preserving; no SF Symbols) and Android VectorDrawables**, both from the same
normalized geometry: `gen-icons.mjs` converts every `<circle>`, `<rect>`, `<line>`, `<polyline>`, `<ellipse>` to path
data and re-serializes all paths (explicit commands, split arc flags), so CoreSVG and Android's PathParser read the same
numbers. Stroke width 2 in a 24 viewport with round caps/joins scales with the icon size, like lucide-react. The set is
every icon the web imports plus every stored account/category key (188 icons, lucide 1.23.0). `BBIcon.account(key)` /
`BBIcon.category(key)` map the legacy DB keys (`home` → `house`, …) and fall back to `wallet` / `package`. The generator
warns about stale assets after an icon disappears from the web.

## Tokens and fonts

The rules are in [`design/tokens.md`](../design/tokens.md).

- **Naming** (§8): drop the leading category, then camel-case the rest. A segment that starts with a
  digit joins the segment before it. Examples:

  | Token | iOS | Android |
  |---|---|---|
  | `color.chart.1` | `Color.bbChart1` | `BBColors.chart1` |
  | `space.1_5` | `BBSpacing.space1_5` | `BBSpacing.space1_5` |
  | `radius.2xl` | `BBRadius.radius2xl` | `BBRadius.radius2xl` |

- **Colors:** `tokens.json` stores `#RRGGBBAA`, with alpha last. iOS keeps that order
  (`Color(bbLight: 0x2F7D571A, dark: …)` unpacks it). Android needs `0xAARRGGBB`, so the generator
  reorders the bytes: `posSoft` `#2f7d571a` becomes `Color(0x1A2F7D57)`.
- **iOS:** `Color.bb*` are dynamic `UIColor` providers, so they follow the system appearance and
  the in-app override. `DesignSystem/Theme.swift` adds:
  - `Font.bb(_:)` and `.bbTextStyle(_:)`, with Dynamic Type anchors and CSS half-leading;
  - `.bbTheme(_:)`, which handles System/Light/Dark and the tint;
  - `.bbShadow`, `.bbRing` and `Animation.bb(_:)`.
- **Android:** `BBLightColors` and `BBDarkColors` implement `BBColors`.
  `designsystem/Theme.kt` maps them onto a Material 3 `colorScheme`, `Typography` and `Shapes`. It
  also exposes every token through `LocalBBColors` and `BuddyBudgetTheme.colors`. Text styles are
  `BBTextStyle.<Name>.style`, and `uppercase` tells the caller to uppercase the text.
- **Fonts:** the variable sources in `design/fonts/` are the files Google Fonts serves to the web.
  They come from [google/fonts](https://github.com/google/fonts) at commit `47d54ca1`, as
  `ofl/{hankengrotesk,spacegrotesk,geistmono}`. Their OFL licenses sit next to them.
  `make-static-fonts.py` pins the static weights listed in tokens.md §2.1 into `design/fonts/static/`:
  Hanken Grotesk and Space Grotesk 400/500/600/700, Geist Mono 400/500. PostScript names follow the
  pattern `HankenGrotesk-Medium`. The generator copies:
  - iOS: `Resources/Fonts/<PostScriptName>.ttf`, which must be listed under `UIAppFonts` in
    `project.yml` (the generator warns when one is missing);
  - Android: `res/font/<family_style>.ttf`, for example `hanken_grotesk_semibold`.

  Both platforms also get the OFL texts for the acknowledgements screen.

  SHA-256 of the variable sources:

  | File | SHA-256 |
  |---|---|
  | `HankenGrotesk[wght].ttf` | `813b3f8f…062662f` |
  | `SpaceGrotesk[wght].ttf` | `acad6de1…ffcfbd79f72` |
  | `GeistMono[wght].ttf` | `d00e590b…c7de8196` |
