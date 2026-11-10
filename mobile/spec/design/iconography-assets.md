# Iconography and assets

## 1. Icon set: Lucide

- Web uses **`lucide-react` 1.23.0** (`package.json` `^1.23.0`, installed 1.23.0). Default attributes (from
  `lucide-react/dist/esm/defaultAttributes.mjs`): viewBox `0 0 24 24`, `fill="none"`, `stroke="currentColor"`,
  **stroke-width 2**, `stroke-linecap="round"`, `stroke-linejoin="round"`. `absoluteStrokeWidth` is never used, so the
  stroke **scales with the icon size** (16 px icon → 1.33 px stroke). This is exactly what a scaled vector asset does,
  so vector assets on native reproduce it with no extra work.
- Overrides found: `check` with `strokeWidth={3}` inside the sync/import islands (14 px). Everything else is default.
- Color: always `currentColor` → native icons are **template images** tinted by the text color of their context.

### 1.1 Sizes in use
`size-4` (16) 139 uses, `size-5` (20) 40, `size-3.5` (14) 33, `size-3` (12) 5, `size-6` (24) 3, `size-7`/`size-8`
(28/32) 4, `size-10`/`size-11` (40/44) 2. Primitive defaults: icons inside `BBButton` 16 (xs 12, sm 14), badges 12,
menu/select items 16, toast icons 16, `InfoHint` 14, `SectionViewsSheet` 20, avatars 16 inside a 36 circle, bottom-nav
tab icons 20. Define `BBIconSize` = `xs 12 | sm 14 | md 16 | lg 20 | xl 24` and
only use those.

### 1.2 Inventory (196 imported names → **188 distinct Lucide SVGs**)
Imported across 256 source files (`app/`, `components/`, `lib/`). Several imports are legacy aliases of the same SVG
(e.g. `AlertTriangle` = `TriangleAlert` → `triangle-alert`; `Home` → `house`; `HelpCircle`/`CircleHelp` →
`circle-question-mark`; `Loader2`/`LoaderCircle` → `loader-circle`; `MoreHorizontal`/`Ellipsis` → `ellipsis`;
`PieChart`/`ChartPie` → `chart-pie`; `BarChart3`/`ChartColumn` → `chart-column`; `CheckCircle2`/`CircleCheck` →
`circle-check`; `AlertCircle`/`CircleAlert` → `circle-alert`; `PlusCircle` → `circle-plus`;
`MessageCircleQuestion` → `message-circle-question-mark`). The canonical SVG file names (lucide-static 1.23.0
`icons/<name>.svg`) to ship:

`activity`, `arrow-down`, `arrow-down-to-line`, `arrow-left`, `arrow-left-right`, `arrow-right`, `arrow-up`, `baby`,
`backpack`, `banknote`, `bell`, `bell-ring`, `bike`, `bitcoin`, `book-open`, `bookmark-check`, `briefcase`, `building-2`,
`bus`, `cake`, `calculator`, `calendar-check`, `calendar-clock`, `calendar-days`, `calendar-range`, `camera`, `car`,
`chart-column`, `chart-line`, `chart-no-axes-column`, `chart-pie`, `chart-spline`, `check`, `chevron-down`,
`chevron-left`, `chevron-right`, `chevron-up`, `chevrons-down`, `circle-alert`, `circle-check`, `circle-dashed`,
`circle-plus`, `circle-question-mark`, `clipboard-paste`, `clock-3`, `coffee`, `coins`, `columns-3`, `compass`, `cpu`,
`credit-card`, `database`, `dollar-sign`, `download`, `droplet`, `droplets`, `dumbbell`, `ellipsis`, `external-link`,
`eye`, `eye-off`, `factory`, `file-spreadsheet`, `file-text`, `file-up`, `film`, `flag`, `flame`, `flask-conical`, `fuel`,
`gamepad-2`, `gauge`, `gem`, `gift`, `git-compare-arrows`, `glasses`, `globe`, `graduation-cap`, `hammer`, `hand-coins`,
`headphones`, `heart`, `heart-pulse`, `history`, `hourglass`, `house`, `inbox`, `info`, `landmark`, `laptop`, `layers`,
`layout-dashboard`, `life-buoy`, `lightbulb`, `link`, `link-2-off`, `list`, `list-checks`, `list-ordered`,
`loader-circle`, `lock-keyhole`, `log-out`, `luggage`, `mail`, `mail-check`, `map-pin`, `menu`,
`message-circle-question-mark`, `message-square`, `monitor`, `monitor-smartphone`, `moon`, `moon-star`, `music`,
`notebook-pen`, `octagon-x`, `package`, `paintbrush`, `palette`, `panel-left`, `paw-print`, `pencil`, `pencil-line`,
`percent`, `pickaxe`, `piggy-bank`, `pill`, `pizza`, `plane`, `play`, `plus`, `printer`, `radio-tower`, `receipt`,
`receipt-text`, `refresh-cw`, `repeat`, `rotate-ccw`, `route`, `scale`, `scissors`, `scroll-text`, `search`,
`search-check`, `settings`, `shapes`, `shield`, `shield-alert`, `shield-check`, `ship`, `shirt`, `shopping-bag`,
`shopping-cart`, `shuffle`, `sliders-horizontal`, `smartphone`, `smile`, `sofa`, `sparkles`, `split`, `star`,
`stethoscope`, `sun`, `table`, `tags`, `target`, `train-front`, `trash-2`, `trending-down`, `trending-up`,
`triangle-alert`, `trophy`, `tv`, `umbrella`, `undo`, `undo-2`, `upload`, `user`, `user-round`, `utensils`, `wallet`,
`wand-sparkles`, `watch`, `wifi`, `wine`, `wrench`, `x`, `zap`.

The list was produced by parsing every `import { … } from "lucide-react"` and resolving aliases through
`lucide-react/dist/esm/lucide-react.mjs`. Re-run the same script in CI (see §1.4) so the native set never drifts.

Non-Lucide inline icons: `components/domain/auth/google-icon.tsx` (Google "G", multicolor — ship as a full-color vector,
not a template) and `components/domain/support/github-icon.tsx` (GitHub mark, template).

### 1.3 Icons whose key is stored in the database
Account and category icons are persisted as **strings** (`lib/validation/accounts.ts` `ACCOUNT_ICONS`, 30 values;
`lib/validation/categories.ts` `CATEGORY_ICONS`, 64 values). The stored keys are **legacy lucide names**; three differ
from the current SVG names. Native apps must map key → asset, never use the key as the file name directly:

| stored key | SVG asset |
|---|---|
| `home` | `house` |
| `help-circle` | `circle-question-mark` |
| `alert-triangle` | `triangle-alert` |
| every other key | same name |

Category keys: utensils, shopping-cart, home, zap, droplet, wifi, tv, smartphone, car, bus, plane, fuel, film, gamepad-2,
music, heart, stethoscope, dumbbell, graduation-cap, baby, paw-print, shield, shirt, scissors, gift, briefcase, wrench,
package, help-circle, shopping-bag, smile, alert-triangle, wallet, credit-card, piggy-bank, banknote, landmark, receipt,
trending-up, coins, flame, sofa, hammer, paintbrush, laptop, headphones, camera, printer, train-front, ship, map-pin,
luggage, coffee, pizza, wine, cake, pill, activity, glasses, book-open, palette, bike, calculator, watch.
Account keys: wallet, credit-card, banknote, building-2, piggy-bank, trending-up, home, car, plane, shopping-cart,
briefcase, dollar-sign, bitcoin, landmark, coins, receipt, package, gift, heart, star, zap, coffee, shopping-bag, user,
globe, smartphone, watch, graduation-cap, flame, music.
Fallbacks: unknown account icon → `wallet`; unknown category icon → `package`. Sector icons (diversification) are a
fixed map in `components/domain/investments/diversification/sector-icons.ts` (cpu, landmark, heart-pulse, factory,
shopping-bag, shopping-cart, radio-tower, …, `circle-question-mark` fallback).

Generate one enum per platform from the validation files (`AccountIcon`, `CategoryIcon`) with the asset name as raw
value, so a new key in the web fails the native build until mapped.

### 1.4 Shipping identical icons (pipeline)
One script in the spec/tooling repo, run in CI of both apps:

1. Read the canonical list (§1.2) — regenerated from the web repo by the parser script — and the pinned version
   `lucide-static@1.23.0` (same version as `lucide-react`; bump both together).
2. Normalize each SVG with SVGO: `convertShapeToPath` (lucide uses `<circle>`, `<rect>`, `<line>`, `<polyline>`,
   `<ellipse>`), keep `stroke`/`stroke-width`/caps/joins, remove `class`, set stroke color to black.
3. **iOS**: write `Icons.xcassets/<name>.imageset/<name>.svg` with `Contents.json`
   `{"properties": {"preserves-vector-representation": true, "template-rendering-intent": "template"}}`, single scale.
   Generate `enum BBIcon: String, CaseIterable { case triangleAlert = "triangle-alert", … }` +
   `Image(bbIcon:)`/`BBIconView(_ icon:, size:)` (`.resizable().frame(width: size, height: size)`). Xcode renders stroked
   SVG paths correctly (strokes scale with the frame, matching lucide's non-absolute stroke).
   Alternative: convert to custom SF Symbols (lets icons follow text weight) — **not recommended**, because SF Symbol
   weight interpolation would change stroke widths and break parity with web/Android.
4. **Android**: convert each normalized SVG to a VectorDrawable (`res/drawable/lucide_<name_with_underscores>.xml`,
   `android:strokeWidth="2"`, `strokeLineCap="round"`, `strokeLineJoin="round"`, `strokeColor="#000"` and tinting via
   `Icon(tint = …)`), or generate Compose `ImageVector` Kotlin code directly (`BBIcons.TriangleAlert`). Use a tool like
   `svg2vectordrawable` / Valkyrie / `s2c` in the script; verify the generated paths with a snapshot test. Generate
   `enum class BBIcon(val drawable: Int)`.
   **Implemented** (2026-10-18): `scripts/export-icons.mjs` + `scripts/gen-icons.mjs` (run by `sync-all.mjs`). Both
   apps use template SVG imagesets / VectorDrawables generated from the same normalized path data; no SF Symbols.
   Rendering: `BBIconView(icon, size:, color:)` on both platforms, sizes `BBIconSize` xs…xl.
5. CI check: compare the canonical list against the web repo (fails if the web adds an icon not shipped natively).
6. License: Lucide is ISC — include the license text in both apps' acknowledgements.

Rendering rules: icons are decorative unless they are the only content of a button → then the button gets an
accessibility label (web uses `aria-label`/`sr-only`); spinners (`loader-circle`) rotate 360° linear 1 s infinite
(Tailwind `animate-spin`), disabled with Reduce Motion only if they convey no progress (keep spinning otherwise).

## 2. Brand assets (`public/brand`, `app/`)

| File | Size | Notes |
|---|---|---|
| `public/brand/logo-mark.svg` (= `app/icon.svg`, byte-identical) | viewBox 378.15 × 463.87 (≈ 0.815:1), 1.7 KB | "BB" mark, three fills: teal `#219ebc`, navy `#1f224e`, amber `#ffb703`. Used in topbar/sidebar/auth at 24×29. **Master for app icons.** |
| `public/brand/logo-full-navy.svg` | viewBox 2175.28 × 463.87 | Mark + wordmark for light backgrounds (wordmark `#0f0f3f`) |
| `public/brand/logo-full-white.svg` | viewBox 2175.28 × 463.87 | Mark + wordmark for dark backgrounds (wordmark `#fff`) |
| `public/icons/icon-512.png` | 512×512 | PWA icon (any + maskable): mark centered on **white**, ~60% of the canvas |
| `public/icons/icon-192.png` | 192×192 | same |
| `public/icons/apple-touch-icon.png` | 180×180 | same |
| `app/favicon.ico` | 16, 32 | — |
| `public/brand/email/logo-mark.png` | 96×118 | email only |
| `public/brand/email/*.woff2` | — | Space Grotesk 400/700, Hanken Grotesk 400/700 (latin subset, email only — native apps must bundle full fonts, see tokens.md) |

Brand colors are **not** UI tokens (decision 2026-09-27: green/red for income/expenses are not brand colors; the sidebar
navy is fixed in both themes). Put them in `tokens.json` under `brand.*` only for logo/splash use.

### 2.1 Native app icons and splash
- **iOS**: 1024×1024 PNG, no alpha, generated from `logo-mark.svg` on white `#ffffff` with the same proportions as
  `icon-512.png` (mark height ≈ 72% of canvas, centered). iOS 18 dark/tinted variants: dark = mark on navy-dark
  background (`#1f224e` is part of the mark → use near-black `#0f0f1f` or the dark `--background`), tinted = grayscale
  mark. These variants are a **design decision to confirm**; the web has no dark icon.
- **Android adaptive icon**: background layer solid `#ffffff`; foreground = `logo-mark` vector (VectorDrawable) inside
  the 72 dp safe zone of the 108 dp canvas; monochrome layer (Android 13 themed icons) = single-color mark silhouette.
  Legacy PNG mipmaps generated from the same source.
- **Splash**: iOS Launch Screen / Android 12 `SplashScreen` API: white (light) / `--background` dark, centered mark
  (Android: animated icon not needed). Match `manifest.ts` `background_color` `#ffffff`.
- App name: "BuddyBudget" (manifest `name`/`short_name`).

## 3. Third-party logos

### 3.1 Import provider logos (`public/import-providers`)
`degiro.svg` (viewBox 72.2×10.2), `interactive-brokers.svg` (270.6×527.2), `trade-republic.svg` (501×44),
`yahoo.svg` (512×143), `fineco.png` (640×261). Licensing in `public/import-providers/ATTRIBUTION.md` (Trade Republic is
CC BY-SA 4.0 → keep attribution in the app's acknowledgements). Ship as full-color vectors (PDF/SVG on iOS,
VectorDrawable on Android; Fineco as PNG @1x/2x/3x from the 640 px source).

### 3.2 Instrument icons (investments)
Logic: `lib/investments/instrument-icon.ts` (`resolveInstrumentIcon`, `findFundIssuer`, `findBrand`, `normalizeName`,
`nameInitials`) + generated data `lib/investments/instrument-icons.generated.ts` (from `scripts/generate-instrument-icons.mjs`).
- **Crypto**: 480 SVGs in `public/instrument-icons/crypto/` (spothq/cryptocurrency-icons, CC0) and
  `CRYPTO_ICON_FILES` (normalized name or symbol → file). Bundle all 480 (they are small) **or** fetch them from the
  web origin `https://app.buddybudget.io/instrument-icons/crypto/<file>.svg` with a disk cache — bundling is
  recommended (offline, no request). Rendered on a white tile in both themes.
- **Stocks (brands)**: 39 `BRAND_ICONS` entries `{slug, title, hex, prefixes, path}` (simple-icons, CC0; trademarks
  remain the owners'): a single 24×24 SVG path filled with the brand hex on a white tile. Export the generated file to
  JSON (`instrument-icons.json`) in the shared spec repo and render the path natively (SwiftUI `Path` from SVG path
  string via a tiny parser, Compose `PathParser().parsePathString(d)`). Keep the matching rules identical
  (`normalizeName` = lowercase, NFD strip diacritics, non-alphanumerics → single space, trim; brand/issuer matches when
  the normalized name equals a prefix or starts with `prefix + " "`).
- **ETF/ETC/fund issuers**: 15 `FUND_ISSUERS` → initials in an issuer swatch (no logos for licensing reasons); ETCs follow the same rule since web #438.
- **Fallback**: initials of the name in the instrument-type swatch.
- **Remote logo**: `GET /api/instruments/{id}/logo` (stocks; ETFs/funds of known issuers) served by the backend — the
  device never talks to third parties.

Golden tests: port the cases of `lib/investments/instrument-icon.test.ts` to both apps (name → icon kind/value).

### 3.3 Merchant logos
`MerchantLogo` uses `logoPath` returned by the API with each transaction group (e.g. `/api/merchant-logos/netflix.com`,
or signed `…?s=<hmac>`, or `/api/merchant-logos/name/<name>?s=…`). The backend resolves dictionary brands, domains found
in the transaction text, or name search through **Logo.dev** (server-side key), caches in Redis and returns 404 when
none. Mobile: load `baseURL + logoPath` **with the user's auth credentials** (these routes require a session — the
native HTTP image loader must attach the same bearer/cookie as API calls), cache on disk honoring `Cache-Control`, and
show the initial while loading/404. Show `LogoCredit` ("Loghi forniti da Logo.dev") under any list that displayed at least
one remote logo (free-plan requirement).

### 3.4 Other
- Landing-only assets (`landing/public/flags/*.svg`, `landing/public/logos/*`) are not needed in the apps.
- `public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` are Next.js template leftovers — ignore.
- World dot map data: `scripts/generate-world-dot-map.mjs` output (used by `WorldDotMap`) → export to JSON for both apps.

## 4. Fonts (asset side)
Fonts are assets too: Hanken Grotesk (`--font-sans`), Space Grotesk (`--font-heading`), Geist Mono (`--font-mono`), all
OFL. Bundle TTF/OTF of the weights used (400, 500, 600, 700) in both apps (iOS `UIAppFonts`, Android `res/font`), from the
same source files the web loads via `next/font` (`app/layout.tsx`: `next/font/google` Hanken_Grotesk, Space_Grotesk, Geist_Mono, latin subset; German needs latin only, so the full latin files suffice). Details and
type scale in `design/tokens.md`.
