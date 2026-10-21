# Formatting and localization

Sources: `lib/localization/{config,messages,format,provider,server,financial-country,planning-availability,categories}.ts`, `lib/localization/catalogs/{en,de}.json`, `lib/format.ts`, `lib/validation/currency.ts`, `components/domain/debts/debts-format.ts`, `components/motion/animated-number.tsx`, `components/domain/net-worth/money-hero.tsx`, `components/domain/accounts/currency-input.tsx`.

Vectors: [`vectors/formatting.json`](vectors/formatting.json), with 194 cases covering every formatter × 3 locales. Locale tables exported from the web's ICU: [`locale-data/locale-data.json`](locale-data/locale-data.json).

---

## 1. Countries, languages, currencies

| Concept | Values | Where stored | Notes |
|---|---|---|---|
| **Product country** | `IT`, `DE` | `user.productCountry` | Decides **features**, not language. IT has everything. DE has inflation, tax 2026 (partial) and income. Pension, retirement (Analitiche/FIRE) and simulations are hidden (`planning-availability.ts`). API prefixes blocked in DE: `/api/pension`, `/api/analytics`, `/api/goals`, `/api/sidebar/fire`, `/api/investments/tax-carryforwards`. |
| **Language** | `it`, `en`, `de` | `user.language` (cookie `bb-language` when signed out) | Allowed pairs: IT → `it`/`en`, DE → `en`/`de`. Invalid stored pair → default (`it` for IT, `en` for DE). Default profile `IT/it`. |
| **Formatting locale** | `it → it-IT`, `en → en-GB`, `de → de-DE` | derived (`LANGUAGE_LOCALES`) | **Not the device locale.** Mobile must format with the locale derived from the account language, whatever the phone's region. |
| **Currency** | `EUR`, `USD`, `GBP`, `CHF` (default `EUR`) | `user.currency` | Independent of language. Instruments and accounts may carry their own currency, so the formatters always take a currency code. |
| Country config | `FINANCIAL_COUNTRIES` | code | IT: `investmentCosts.annualStampDutyRate = 0.002` (bollo). DE: 0. Inflation area per country. |

Mobile must mirror `isCountryPathAvailable` and `isPlanningAvailable` to hide tabs and screens. Better: ask the server for a `features` object in `/api/user/settings`, so rollout switches stay server-controlled. **Recommendation:** expose `GET /api/me/capabilities` → `{productCountry, language, locale, currency, features:{taxes,pension,retirement,incomeForecasts,inflation}, planning:{tax,income,pension,retirement,simulations}}`.

## 2. Number and money formatting

All formatters live in `localizedFormats(locale)`. Many components use `formatCurrency` from `lib/format.ts`, which defaults to `it-IT`.

| Function | Rule | it-IT | en-GB | de-DE |
|---|---|---|---|---|
| `formatCurrency(v, cur, {maximumFractionDigits=2})` | `Intl.NumberFormat(locale,{style:"currency", currency, maximumFractionDigits})`. The minimum fraction digits come from the currency (2), so 0 shows as "0,00". | `1234,50 €` | `€1,234.50` | `1.234,50 €` |
| same, `maximumFractionDigits: 0` | rounds half away from zero (ICU halfExpand) | `1235 €` | `€1,235` | `1.235 €` |
| negative | ASCII hyphen-minus `-` | `-1234,50 €` | `-€1,234.50` | `-1.234,50 €` |
| `formatSignedCurrency(v,cur)` | sign prefix `+` or `−` (**U+2212**) + format(|v|). Zero shows "+". | `+250,00 €` / `−250,00 €` | `+€250.00` | `+250,00 €` |
| `formatPct(r, digits=1)` | `style:"percent"`, min = max = digits. **Input is a ratio** (0.1234 shows 12.3 %). | `12,3%` | `12.3%` | `12,3 %` (U+00A0) |
| `formatSignedPct(r)` | `+`/`−`(U+2212) + pct(|r|) | `+12,3%` | | |
| `formatPrice(v,cur)` | currency with `maximumFractionDigits = |v|<10 ? 4 : 2` | `1,2346 USD` | `US$1.2346` | `1,2346 $` |
| `formatCompactAmount(v)` | `notation:"compact", maximumFractionDigits:1`, **no currency** | `1,2K`, `2,5 Mln` | `1.2k`, `2.5m`, `1.2bn` | `1234`, `15.300`, `2,5 Mio.` |
| `formatRatio(v,digits=1)` | plain decimal with fixed digits | `1234,5` | `1,234.5` | `1.234,5` |
| `getCurrencySymbol(cur)` | formats 0 and strips digits, spaces and separators | `€`, `USD`, `£`, `CHF` | `€`, `US$`, `£`, `CHF` | `€`, `$`, `£`, `CHF` |

Key details (all covered by vectors):
- **it-IT does not group 4-digit numbers** (CLDR `minimumGroupingDigits = 2`): `1234,50 €`, but `12.345,68 €`. de-DE and en-GB group from 4 digits.
- In it-IT and de-DE the currency is separated by **U+00A0** (no-break space). In it-IT, USD is shown as the ISO code ("10,00 USD").
- Half-cent rounding: `0.005` gives `0,01 €`, and `-0.004` gives `-0,00 €` (a negative zero is kept). Port both behaviours.
- **Amount masking (privacy mode):** when the user hides amounts, every `formatCurrency` returns `AMOUNT_MASK = "••••"` (4 × U+2022). Percentages and quantities stay visible. That is a known web gap; mobile should keep parity.
- **Hero amounts with a "muted tail"** (`MoneyHero`, `AnimatedNumber mutedTail`): the formatted string is split at the decimal separator (`splitMoney`). `main` is everything before it, and `tail` is the decimal separator, decimals and any trailing currency. The tail is rendered at 0.55em in `muted-foreground`. Examples: it `{"main":"1234","tail":",50 €"}`, en `{"main":"€1,234","tail":".50"}`.
- **Animated numbers:** `AnimatedNumber` (NumberFlow) uses the same `Intl.NumberFormat` options and `tabular-nums`, and respects reduce-motion. See `design/components.md`.
- **Currency input** (`CurrencyInput`): the currency symbol is shown as a static prefix. Group and decimal separators come from the locale. At most 2 decimals; negatives allowed. On mobile, use a decimal keyboard and accept **both** `,` and `.` as the decimal separator on input.
- Durations (`formatDuration(months)`): the years and months parts are joined with `Intl.ListFormat(long, conjunction)`. Examples: it "2 anni e 1 mese", en "2 years and 1 month", de "2 Jahre und 1 Monat". Zero months gives "0 mesi".

## 3. Dates

Data dates are **calendar strings `YYYY-MM-DD`** and must be parsed as local dates. Instants (`createdAt`, `syncedAt`) are ISO timestamps.

| Function | Options | it-IT | en-GB | de-DE |
|---|---|---|---|---|
| `formatShortDate("2026-09-26")` | `{day:"numeric", month:"short"}` | `26 set` | `26 Sept` | `26. Sept.` |
| `formatDateWithYear` | + `year:"numeric"` | `26 set 2026` | `26 Sept 2026` | `26. Sept. 2026` |
| `formatLongDate(date)` | `{day, month:"long", year}` | `29 ottobre 2026` | `29 October 2026` | `29. Oktober 2026` |
| `formatMonthLabel("2026-03")` | `{month:"long", year}` | `marzo 2026` | `March 2026` | `März 2026` |
| `shortMonthLabel(m)` | `{month:"short"}` and **remove the first "."** | `gen…dic` | `Jan… Sept …Dec` | `Jan, Mär, Mai, Sep, Okt, Dez` |
| `dayLabel` (movement feed) | `{weekday:"long", day, month:"long"}` (+year if not current) | `lunedì 5 ottobre` | `Monday 5 October` | `Montag, 5. Oktober` |
| `formatPeriodLabel`, `formatCashflowPeriodLabel` | see expenses.md / cashflow.md | | | |

Other skeletons in use (outputs for each locale in `locale-data.json → dateSkeletonsSample`): `MMM yy`, `MMM y`, `d MMM yy`, `dd MMM y`, `d MMMM`, `EEE d MMMM y`, `HH:mm`.

Strings to watch:
- The capitalisation helpers uppercase only the first character ("Ottobre 2026").
- Some web formatters are **hard-coded to `it-IT`**: `buildNetWorthSeries` labels, `formatCashflowPeriodLabel`, and the `MONTH_LABELS` array (`Gen…Dic`) used by `compute6MonthTrend`, `computeMonthlySeries` and `computeCategoryMonthlyStacks`. **Mobile should localize these** with the matching skeleton. They are known web i18n gaps; report them to the web team so the outputs converge.
- **"Today":** the Liquidità, expenses and net-worth modules use the **device-local date**. Debts use the **UTC date** (`todayIso`, see debts.md). Notification dates use `Europe/Rome`. Mobile must reproduce each choice where it matters.

### Relative time (`formatRelativeTime(date, now)`)
- **it-IT** uses custom code:
  - < 1 min → "adesso"
  - < 60 min → "{n} min fa"
  - < 24 h → "{n} h fa"
  - < 7 days → "1 giorno fa" or "{n} giorni fa"
  - otherwise → `d MMM` ("16 lug")
- **en and de** use `Intl.RelativeTimeFormat(locale,{numeric:"auto"})` with the same thresholds, floored: "now", "5 minutes ago", "3 hours ago", "yesterday", "2 days ago" / "jetzt", "vor 5 Minuten", "gestern", "vorgestern". Beyond 7 days → `d MMM`.
- Because of `numeric:"auto"`, en shows "yesterday" where it shows "1 giorno fa". This is intended.

<a id="icu-drift"></a>
### ICU drift: why mobile must not use the platform formatters directly
The reference outputs come from **Node 25 / ICU 78 / CLDR 48**, the web server's runtime. Browsers, iOS (`NumberFormatter`, `Date.FormatStyle`) and Android (`android.icu`, `java.text`) ship different CLDR versions. Some outputs that differ between versions:
- en-GB `Sept` vs `Sep`
- de `26. Sept.` vs `26. Sep.`
- whether it-IT groups 4 digits
- en `Monday 5 October` vs `Monday, 5 October`
- the compact abbreviations (`Mln`, `Mio.`)

Even the web is not perfectly consistent: client-rendered text uses the browser's ICU.

**Recommendation:** build one small deterministic formatting module per platform, `BBFormat` (Swift) and `BBFormat` (Kotlin), with the **same API as `localizedFormats`**. Back it with a data table generated from the web's ICU (`locale-data/locale-data.json`: separators, minimum grouping digits, currency patterns and symbols, month and weekday names, sample skeleton outputs, compact patterns). Validate it with `vectors/formatting.json`. Platform formatters may be used only behind this facade, and only if the vectors pass. Regenerate both files whenever the web's Node version changes (`node domain/tools/export-locale-data.mjs domain/locale-data/locale-data.json` and `domain/tools/gen-formatting-vectors.ts`, see §6).

## 4. String catalogs: where and how they work today

- **Location:** `lib/localization/catalogs/en.json` and `lib/localization/catalogs/de.json`. These are flat JSON objects `{ "<Italian source string>": "<translation>" }` with **4 191 keys each** (identical key sets). About 10 extra entries are declared inline in `lib/localization/messages.ts`.
- **Source language:** Italian. **The key is the Italian text itself.** `translate("it", s)` returns `s` unchanged. For en/de it looks up `messages[s]` and **falls back to the Italian source** when the key is missing.
- **Interpolation:** `{name}` placeholders. The regex is `\{(\w+)\}`. 446 keys use positional `{0}`, `{1}` (up to 5 per key) and 8 use named ones (`{month}`, `{amount}`). Replacement happens after lookup. Unknown placeholders are left as-is. A test (`completeness.test.ts`) checks that every catalog value keeps the same `{n}` placeholders and that every literal `t("…")` / `tr("…")` call in `app`, `components` and `lib` has a translation.
- **Call sites:** `const { t } = useLocalization(); t("Testo italiano", {0: x})` on the client, `getTranslator()` on the server, `translate(language, s)` in pure modules.
- **Fragments:** 48 keys have significant leading or trailing spaces, and many keys are sentence fragments joined with formatted values (e.g. the voice lines in month-pace.md). Keep whitespace byte-exact.
- **Pluralization:** there is **no ICU plural support**. Code chooses between two keys with `n === 1 ? "{0} anno" : "{0} anni"`. Mobile must reproduce the same `== 1` rule for parity. The CLDR `one` category matches `n == 1` for integers in it, en and de.
- **Data-driven strings from the API:** some APIs return already translated text: `/api/financial-planning`, `/api/investments/portfolio`, `/api/instruments/[id]/commentary`, and default category names via `localizeCategory`. Others return **Italian source labels** that the web client passes through `t()`, e.g. group labels "Dovute", "Altro", "Oggi", subscription reasons and cadence labels. Mobile therefore needs **both** compile-time accessors and a **runtime lookup by Italian source string**.
- User-entered text (account names, category names the user typed, descriptions) is never translated.
- Content: 110 keys contain `%`, 380 contain `'`, and none contain markup. This matters for Android escaping.

## 5. Recommendation: one catalog, generated for both apps

**Single source of truth remains the web catalogs.** Mobile-only strings are added to the **same** `catalogs/*.json` (Italian key + en + de) in the web repo, so the existing completeness test, translators' workflow and placeholder check cover them.

### Pipeline
> **Implemented** in [`scripts/`](../scripts/README.md) as dependency-free Node scripts: `export-strings.mjs`, `gen-strings-ios.mjs` and `gen-strings-android.mjs`, run together by `sync-all.mjs`. Inline `messages.ts` entries are parsed from the source rather than imported. The Android output goes to the `:app` module (`app/src/main/res/values{,-en,-de}/strings_generated.xml`). Mobile-only strings live in `strings/mobile.json` until they move to the web catalogs. The sketch below is the original design.

```
web repo                         spec/mobile tooling (CI job "strings")
lib/localization/catalogs/*.json ─┐
lib/localization/messages.ts ─────┼─► scripts/export-strings.ts (tsx, imports `messages` so inline keys are included)
                                  │        └─► strings/catalog.json  (canonical, committed to the mobile repos or published as a CI artifact)
                                  │
strings/catalog.json ─► gen-ios.ts     ─► ios/BuddyBudget/Resources/Localizable.xcstrings  + Generated/L10n.swift
                     └► gen-android.ts ─► android/core/i18n/src/main/res/values{,-en,-de}/strings.xml + generated/L10n.kt
```

### `strings/catalog.json` (canonical format)
```json
{
  "version": "2026-10-18T12:00:00Z+<web git sha>",
  "sourceLanguage": "it",
  "languages": ["it", "en", "de"],
  "entries": [
    {
      "id": "reconnect_to_0_9f3a1c",
      "source": "Ricollega a \"{0}\"",
      "it": "Ricollega a \"{0}\"",
      "en": "Reconnect to \"{0}\"",
      "de": "Erneut mit „{0}“ verbinden",
      "placeholders": ["0"]
    }
  ]
}
```
- **`id`** = `snake(english text, ≤ 40 chars, [a-z0-9_])` + `_` + the first 6 hex characters of `sha1(italian source)`. It is stable while the Italian source is unchanged, and it is a valid Android resource name and Swift identifier (prefix `s_` if it starts with a digit). When the Italian source changes, the ID changes and mobile code stops compiling until the call site is reviewed. That is intentional.
- **`placeholders`**: names in order of first appearance. Named and positional placeholders are mapped to positional arguments in that order.

### iOS (`.xcstrings`)
- Generate `Localizable.xcstrings` (JSON) with `sourceLanguage: "it"`. Each key is the `id`. `localizations.{it,en,de}.stringUnit = {state:"translated", value}`. Placeholder `{x}` becomes `%N$@` and a literal `%` becomes `%%`.
- Generate `L10n.swift`:
  - accessors such as `static func reconnectTo0(_ p0: String) -> String`, with doc comments holding the Italian and English text;
  - a runtime map `L10n.translate(source: String, values: [String: String])` for Italian labels that come from the API, built from a generated `[String: String]` dictionary keyed by source.
- **Language comes from the account, not the device.** Resolve strings through a `Bundle` pointing to `<lang>.lproj` (`L10n.bundle`), and switch it when `user.language` changes. Also set `Locale(identifier: "it_IT" | "en_GB" | "de_DE")` for `BBFormat`.

### Android (`strings.xml`)
- `values/strings.xml` holds Italian (default), plus `values-en/` and `values-de/`.
- Escape `'` → `\'`, `"` → `\"`, `@`/`?` at the start, `%` → `%%`, and `\n`. Leading and trailing spaces need `"…"` quoting.
- Placeholder `{x}` becomes `%N$s`. Add `formatted="false"` where needed.
- Generate `L10n.kt` with the runtime lookup map for API-provided Italian labels.
- Apply the account language with `AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags("it-IT"|"en-GB"|"de-DE"))` (per-app locale; persisted on Android 13+).

### Rules for both
- **Plurals** stay as two keys with an explicit `n == 1` choice, for parity with the web. If the web later adopts ICU MessageFormat plurals, the exporter emits `.xcstrings` `variations.plural` and Android `<plurals>` from the same JSON.
- CI checks:
  1. every entry has it, en and de;
  2. placeholders match across languages (same as `completeness.test.ts`);
  3. no generated ID collision;
  4. the mobile build fails if an accessor is referenced but missing.
- Strings shown by both apps must use the same entry, so the wording is identical.

### Known web i18n gaps (decide before porting)
| Gap | Where | Effect | Mobile recommendation |
|---|---|---|---|
| Italian sentences built with template literals that never go through `t()` | `components/domain/analytics/plain-answers.ts` (Analitiche answers; `guided-steps.ts` is mostly translated but has 2 template literals) | An IT user with language `en` sees Italian | Move them into catalog keys with `{0}` placeholders in the web first (the feature is IT-only), then consume the keys |
| Hard-coded `it-IT` formatters | `buildNetWorthSeries` labels, `formatCashflowPeriodLabel`, `MONTH_LABELS` | Chart labels are always Italian | Localize on mobile; fix the web to match |
| Masking covers only `formatCurrency` | privacy mode | Quantities and percentages stay visible | Keep parity, or mask more in both |
| `formatCurrency` callers that omit `locale` default to `it-IT` | 15 files import `@/lib/format` directly | Possible Italian number format in en/de | Mobile always passes the account locale |

## 6. Locale data exporter (reference)
`locale-data/locale-data.json` was produced by [`tools/export-locale-data.mjs`](tools/export-locale-data.mjs), a ~50-line Node script that queries `Intl` for each of `it-IT`, `en-GB` and `de-DE`. It records the decimal and group separators, minimum grouping digits, minus sign, percent pattern, currency pattern and symbol for EUR/USD/GBP/CHF, compact outputs for 1e3…1e12, long, short and in-date month names, long and short weekday names, outputs for every date skeleton the web uses, and the list conjunction. Keep it next to `export-strings.ts` and run it in the same CI job with the web's pinned Node version.

## 7. Golden vectors (excerpt from `vectors/formatting.json`)

| id | input | expected |
|---|---|---|
| currency.it-IT.1234.5.EUR | 1234.5 EUR it-IT | `1234,50 €` (U+00A0 before €) |
| currency.it-IT.12345.678.EUR | | `12.345,68 €` |
| currency.en-GB.10.USD | | `US$10.00` |
| currency.de-DE.-0.004.EUR | | `-0,00 €` |
| signedCurrency.it-IT.-250 | | `−250,00 €` (U+2212) |
| pct.de-DE.0.1234 | | `12,3 %` (U+00A0) |
| price.en-GB.1.23456 | USD | `US$1.2346` |
| compact.de-DE.15300 | | `15.300` |
| compact.it-IT.2500000 | | `2,5 Mln` |
| shortMonth.en-GB.9 | | `Sept` |
| shortDate.de-DE | 2026-09-26 | `26. Sept.` |
| relative.it-IT.90000000 | 25 h ago | `1 giorno fa` |
| relative.en-GB.90000000 | 25 h ago | `yesterday` |
| relative.de-DE.172800000 | 48 h ago | `vorgestern` |
| splitMoney.en-GB | 1234.5 EUR | main `€1,234`, tail `.50` |
| duration.de.25 | 25 months | `2 Jahre und 1 Monat` |
| translate.de.Ricollega a "{0}" | {0:"Conto corrente"} | `Erneut mit „Conto corrente“ verbinden` |
| translate.de.Chiave inesistente {x} | missing key | `Chiave inesistente 1` (Italian fallback) |

## 8. Native API (`BBFormat`, `Periods`)

Both apps ship the same facade with the **web's function names**. iOS: `BuddyBudgetKit/Sources/BuddyBudgetKit/Domain/` (`BBFormat*.swift`, `Format*.swift`, `Periods*.swift`). Android: `core/src/main/kotlin/io/buddybudget/core/domain/format/` and `…/domain/periods/`. Neither uses `NumberFormatter` / `DateFormatter` / `DecimalFormat` / `DateTimeFormatter` / `android.icu` for output. Everything is built from the bundled copy of `locale-data/locale-data.json`.

### Types
| Concept | Swift | Kotlin |
|---|---|---|
| Formatting locale | `BBLocale.itIT / .enGB / .deDE` (`init?(tag:)`, `init(language:)`) | `BBLocale.IT_IT / EN_GB / DE_DE` (`fromTag`, `of(language)`) |
| Account language | `BBLanguage.it / .en / .de` | `BBLanguage.IT / EN / DE` (`fromCode`) |
| Calendar date (`YYYY-MM-DD`, no zone) | `CalendarDate(year:month:day:)`, `CalendarDate(iso:)`, `.iso`, `.monthKey` | `CalendarDate(year, month, day)`, `CalendarDate.parse(iso)`, `.iso`, `.monthKey` |
| Date skeletons | `BBDateSkeleton` (`.dMMM`, `.dMMMy`, `.dMMMMy`, `.dMMMM`, `.MMMMy`, `.MMMy`, `.MMMyy`, `.dMMMyy`, `.ddMMMy`, `.EEEEdMMMM`, `.EEEEdMMMMy`, `.EEEdMMMMy`, `.HHmm`) | `BBDateSkeleton` (`D_MMM`, `D_MMM_Y`, …, `HH_MM`) |
| Instants | `Date` + `TimeZone` | `Instant` + `ZoneId` |

`month` is **1-based** in `CalendarDate` and in `shortMonthLabel(month)`, as in the web's `shortMonthLabel`. Vectors that carry JS 0-based months are converted by the test adapters.

### `BBFormat` (formatting.json)
Signatures are shown in Swift. Kotlin uses the same names and parameter order, with the locale before the optional parameters: `formatPct(ratio, locale, digits = 1)`.

| Function | Web source | Notes |
|---|---|---|
| `formatCurrency(_ value, currency:, locale:, maximumFractionDigits: 2, masked: false)` | `lib/format.ts` | min fraction digits = min(2, max). `masked` returns `amountMask` / `AMOUNT_MASK` (`••••`). |
| `formatSignedCurrency(_, currency:, locale:, masked:)` | `localizedFormats` | `+` / `−` (U+2212) + format(\|v\|). Masked gives `+••••`, like the web. |
| `formatPrice(_, currency:, locale:, masked:)` | `localizedFormats` | 4 decimals when \|v\| < 10. |
| `formatPct(_ ratio, digits: 1, locale:)` / `formatSignedPct` | `localizedFormats` | input is a ratio |
| `formatCompactAmount(_, locale:)` | `localizedFormats` | ICU compact, `maximumFractionDigits: 1`, min-grouping 2 |
| `formatRatio(_, digits: 1, locale:)`, `formatNumber(_, minimumFractionDigits:, maximumFractionDigits:, locale:)` | `localizedFormats` | plain decimal |
| `getCurrencySymbol(_ currency, locale:)` | `lib/format.ts` | |
| `splitMoney(_, currency:, locale:)` → `(main, tail)` / `MoneyParts` | `money-hero.tsx` | not masked (the web's `MoneyHero` checks the mask separately) |
| `formatDate(_ date, _ skeleton, locale:)`, `formatTime(hour:minute:locale:)` | — | generic skeleton formatter used by the functions below |
| `formatShortDate(iso)`, `formatDateWithYear(iso)`, `formatLongDate(date)`, `formatMonthLabel("YYYY-MM")`, `formatMonthYear(date)` | `lib/format.ts`, `localizedFormats`, `debts-format.ts` | invalid ISO input is returned unchanged |
| `shortMonthLabel(month \| "YYYY-MM")`, `monthName(month)`, `monthNameShort(month)`, `capitalize` | `localizedFormats`, `expenses.ts` | stand-alone month names |
| `dayLabel(date, today:, locale:)` | `lib/liquidity/day-groups.ts` | returns the catalog keys `"Oggi"` / `"Ieri"` untranslated |
| `formatRelativeTime(date, now:, locale:, timeZone:)` | `localizedFormats` | the `d MMM` fallback uses `timeZone` (the device zone in the app) |
| `formatDuration(months, language:, translate: nil)`, `formatList(items, locale:)` | `debts-format.ts` | the five catalog keys (`{0} anno/anni/mese/mesi`, `0 mesi`) are built in. Pass `translate` to use the generated catalog instead. |
| `interpolate(template, values)` | `messages.ts` (`translate`) | `{name}` replacement only. The catalog lookup is `L10n.translate`. |
| `parseAmount(text)` | `lib/debts/add-form.ts` | `"1.250,50"` → 1250.5, `"6,9"` → 6.9, `"1.250"` → 1.25, `""`/`"abc"` → nil/null |
| `parseAccountAmount(text)` | `lib/validation/accounts.ts` | first comma → `.`, dots kept (`"1.250,50"` → nil/null) |

Helpers: `JSNumber.parse` (JS `Number(string)`), `JSNumber.trim`, `JSNumber.round` (JS `Math.round`), `round2`, `round2Epsilon` (debts' `round2` with `Number.EPSILON`).

**Rounding.** Numbers are rounded the way ICU rounds them. Take the **shortest round-trip decimal** of the double (Swift `description`, JDK 19+ `Double.toString` with a 1-digit fix-up), then apply half-expand in decimal. So `1.005` → `1,01 €`, but `(1.005).toFixed(2)` → `"1.00"`. A negative value that rounds to zero keeps its sign (`-0,00 €`).

### `Periods` (expenses, cashflow, net-worth, debts, goals, pension, italian-taxes, fire-and-simulations, returns)
| Function | Web source | Month arithmetic |
|---|---|---|
| `getPeriodRange`, `getPreviousPeriodRange`, `shiftReferenceDate`, `scaleBudgetForPeriod`, `formatPeriodLabel(period, range, locale)` (`ExpensePeriod`) | `lib/calc/expenses.ts` | JS overflow |
| `getCashflowPeriodRange`, `getPreviousCashflowPeriodRange`, `shiftCashflowReferenceDate`, `formatCashflowPeriodLabel(range, locale = it-IT)` (`CashflowPeriod`) | `lib/calc/cashflow.ts` | clamped |
| `getTrendRange(ExpensePeriod, date)` | `lib/calc/movements.ts` | overflow from the 1st (safe) |
| `getNetWorthPeriodRange(NetWorthPeriod, today:, earliestDate:)` | `lib/calc/net-worth.ts` | clamped |
| `resolvePeriodRange(DataPeriod, today:)`, `monthSpan` | `lib/analitiche/period.ts` | JS overflow |
| `monthsBetween`, `addMonthsKey` | `lib/goals/plan.ts` | month index |
| `wholeYearsBetween`, `daysBetween`, `isoWeek` → `IsoWeek`, `todayUTC(now)` (debts' `todayIso`) | pension, returns, heatmap, debts | |
| `CalendarDate.addingMonthsOverflow` / `plusMonthsOverflow` | expenses `addMonths` | JS overflow |
| `CalendarDate.addingMonthsClamped(n, anchorDay:)` / `plusMonthsClamped` | debts `addMonthsClamped`, pension `addMonths`, dividends `shiftMonths`, cashflow `addWholeMonths` | clamped |
| `CalendarDate.js(year:monthIndex:day:)` | `new Date(y, m, d)` | JS overflow |

### Locale data refresh
The JSON is bundled, never generated at build time. iOS: SwiftPM resource `Sources/BuddyBudgetKit/Domain/LocaleData/locale-data.json`. Android: `core/src/main/resources/io/buddybudget/core/domain/format/locale-data.json`. After a spec bump, copy `spec/domain/locale-data/locale-data.json` over both. A test on each platform fails while a copy differs from the spec file.

The en/de relative-time phrases (`now`, `{0} minutes ago`, `yesterday`, `jetzt`, `vor {0} Minuten`, `gestern`, `vorgestern`, …) are **not** in `locale-data.json`. They are hard-coded from CLDR 48 in `BBFormat` on both platforms. Add them to the exporter if they ever need to change.

### Tests
- **Android:** `./gradlew :core:test` runs one JUnit `Parameterized` class per vector file (`FormattingVectorsTest`, …). Each vector is its own case, named by its id. Deferred vectors are reported as skipped.
- **iOS:** `swift test` runs one Swift Testing `@Test(arguments:)` per file. `swift run vector-check [--verbose] [file.json …]` runs the same adapters without XCTest or Swift Testing and exits non-zero on any failure.
- `SPEC_DIR=<dir>` overrides the spec location on both platforms. Use it to run ad-hoc vector sets, e.g. a fuzz set generated with the web's Node.
- In covered files, functions outside BBFormat/Periods are **deferred explicitly** with the phase that ports them. An unknown function name still fails.
