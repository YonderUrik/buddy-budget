# Components — inventory and native equivalents

Source of truth: `components/ui/*` (shadcn `base-nova` primitives on `@base-ui/react`), `components/domain/*`,
`components/motion/*`, `components/layout/*`, `components/privacy-provider.tsx`, `components/theme-*.tsx` in the web repo
(lucide-react 1.23.0, recharts 3.8.1, motion 13, @number-flow/react 0.6, sonner 2).

Related specs: `design/tokens.md` + `design/tokens.json` (colors, type, radii, spacing, motion), `design/charts.md`,
`design/iconography-assets.md`, `domain/formatting-localization.md` (all number/date formatting used below).

## 0. Conventions

### 0.1 Token references
Tokens are written by their **CSS variable name** (`--primary`, `--muted-foreground`, `--text-2`, `--swatch-teal`, `--pos`, `--neg`, …).
The native name is the camelCase form inside the generated theme: `--muted-foreground` → `BBColor.mutedForeground` (Swift) /
`BBTheme.colors.mutedForeground` (Kotlin). See `design/tokens.json` for the exact key list. Tailwind opacity modifiers
(`bg-primary/10`, `ring-foreground/10`) mean "token color at that alpha": `--primary @ 10%`.

Tailwind spacing → points/dp: **1 unit = 4 pt/dp** (`p-4` = 16, `gap-1.5` = 6, `size-9` = 36, `h-8` = 32, `min-h-11` = 44).
Text sizes: `text-xs` 12/16, `text-sm` 14/20, `text-base` 16/24, `text-lg` 18/28, `text-xl` 20/28, `text-2xl` 24/32,
`text-3xl` 30/36, `text-5xl` 48/48, `text-6xl` 60/60 (size/line-height). Families: `font-sans` = Hanken Grotesk,
`font-heading` = Space Grotesk, `font-mono` = Geist Mono. `tabular-nums` → monospaced digits
(`.monospacedDigit()` in SwiftUI, `fontFeatureSettings = "tnum"` in Compose) — **mandatory on every amount**.

### 0.2 Mobile presentation is the reference
The web app already has a phone layout (breakpoint `sm` = 640 px, `md` = 768 px, `lg` = 1024 px). **Native apps
reproduce the `max-sm` (phone) presentation**, never the desktop one:

| Web on desktop | Web under `sm` (→ native) |
|---|---|
| Centered `Dialog` (zoom-from-origin) | Bottom sheet with drag handle, swipe-down to dismiss |
| `FormDialogContent` centered `max-w-lg` | Full-screen modal with a 44 pt close button top-right |
| `AlertDialog` centered `max-w-sm` | Bottom sheet (same as dialog) |
| `SectionTabs` segmented links (≥ `lg`) | `SectionHeading` title "View ⌄" → `SectionViewsSheet` |
| Sidebar | `BottomNav` (4 tabs + "Altro") + `MobileMoreMenu` |
| `InlineOrSheet` inline panel under a row | Bottom sheet |
| Hover tooltips | Press-and-drag scrubbing (see `charts.md`) / `InfoHint` popover → sheet or popover |

### 0.3 Naming and API rule
- Primitives from `components/ui` get the **`BB` prefix on both platforms** (they collide with `SwiftUI.Button`,
  `androidx.compose.material3.Button`, etc.): `BBButton`, `BBBadge`, `BBCard`, `BBSlider`, `BBSwitch`, `BBCheckbox`,
  `BBTextField`, `BBTextArea`, `BBLabel`, `BBSeparator`, `BBSelect`, `BBMenu`, `BBPopover`, `BBSheet`, `BBAlertSheet`, `BBToast`.
- Domain components keep the **exact web name** (`StatCard`, `MoneyHero`, `SegmentedControl`, `EmptyState`, `MerchantLogo`, …).
- Parameters keep the web prop names (camelCase on both). Enums keep the web literal values as case names
  (`variant: .destructive` / `ButtonVariant.Destructive`). Callbacks: web `onX` → Swift trailing closure / `onX: () -> Void`;
  Kotlin `onX: () -> Unit`. Two-way values: Swift `Binding<T>`, Kotlin `value: T, onValueChange: (T) -> Unit`.
- Every user-visible string passed to a component is a **catalog key** (the Italian source string, see
  `domain/formatting-localization.md`); components translate internally exactly like the web `tr()` does. Swift:
  `LocalizedStringKey`/`String(localized:)`; Kotlin: `stringResource(R.string.<key_id>)` resolved by the caller or a `BBText` key type.
- Amounts are always formatted through the shared formatting module (never ad-hoc), so **privacy masking** works (§7).

### 0.4 Interaction states (all interactive components)
| State | Web | Native |
|---|---|---|
| Pressed | `active:translate-y-px` (buttons), hover bg | 1 pt downward offset **or** bg = hover bg while pressed; no ripple on Android (`indication = null` + custom pressed bg) to match iOS |
| Focus (keyboard) | `ring-3 ring-ring/50` + `border-ring` | Only on hardware keyboard focus: 3 pt outline `--ring @ 50%` |
| Disabled | `opacity-50`, no pointer | `opacity(0.5)`, not hittable |
| Invalid | `border-destructive` + `ring-3 ring-destructive/20` (dark: `/40`) | same colors |
| Minimum touch target | most controls use `min-h-11` (44) on phone | 44 pt iOS / 48 dp Android hit area (visual size unchanged, expand hit area) |

---

## 1. Primitives (`components/ui`)

### 1.1 Button — `BBButton`
Source `components/ui/button.tsx`. Base (Phase 4R, web #427): **every button is a pill** (`rounded-full`), 1 px
transparent border, `text-sm font-medium`, icon 16, gap 6, no wrap. String labels animate with `TextMorph` when they change ("Salva" → "Salvataggio…" → "Salvato").

| variant | Background | Text | Pressed/hover bg | Border |
|---|---|---|---|---|
| `default` | `--primary` | `--primary-foreground` | `--primary @ 80%` | — |
| `sun` | `--sun` | `--on-sun` | `--sun-hover` | — | the page's **main action** (#405): sign-in and onboarding primary, «Aggiungi» in Liquidità, Debiti, Investimenti |
| `outline` | `--secondary` (**filled**, #427) | `--secondary-foreground` | `--secondary` mixed 6% toward `--foreground` | — |
| `secondary` | `--secondary` | `--secondary-foreground` | `--secondary` mixed 5% toward `--foreground` (oklch) | — |
| `ghost` | clear | inherit | `--muted` (dark: `--muted @ 50%`) | — |
| `destructive` | `--destructive @ 10%` (dark 20%) | `--destructive` | `--destructive @ 20%` (dark 30%) | — |
| `link` | clear | `--primary`, underline on press (offset 4) | — | — |

| size | Height | H-padding | Radius | Icon | Text |
|---|---|---|---|---|---|
| `xs` | 24 | 8 | full | 12 | 12 |
| `sm` | 28 | 10 | full | 14 | 12.8 |
| `default` | 32 | 10 | full | 16 | 14 |
| `lg` | 36 | 10 | full | 16 | 14 |
| `icon` / `icon-xs` / `icon-sm` / `icon-lg` | 32 / 24 / 28 / 36 square | 0 | full | 16/12/16/16 | — |

`BBSunIconButton(accessibilityLabel, icon = plus)`: the round 44 pt yellow main action next to a page or view title (web
`Button variant="sun"` `size-11` with a plus on the phone).

On phone many call sites override to `h-11 px-4` (44 pt): `EmptyState` actions, primary form actions. Provide `size: .lg` +
`fullWidth` modifiers instead of ad-hoc overrides; add a `touch` size = 44 height, 16 padding used by EmptyState/StepActions.

```swift
struct BBButton<Label: View>: View {
  init(variant: BBButtonVariant = .default, size: BBButtonSize = .default, isDisabled: Bool = false,
       action: @escaping () -> Void, @ViewBuilder label: () -> Label)
  init(_ titleKey: String, icon: BBIcon? = nil, iconPosition: IconPosition = .start, variant:…, size:…, action:)  // text morphs
}
```
```kotlin
@Composable fun BBButton(onClick: () -> Unit, modifier: Modifier = Modifier, variant: ButtonVariant = ButtonVariant.Default,
  size: ButtonSize = ButtonSize.Default, enabled: Boolean = true, content: @Composable RowScope.() -> Unit)
@Composable fun BBButton(text: String, onClick: () -> Unit, icon: BBIcon? = null, /* … */)  // text morphs
```
`TextMorph` native: animate per-character with a matched-geometry/`AnimatedContent` letter transition: shared letters slide
(spring stiffness 420, damping 34, mass 0.8), new letters fade in 260 ms after 60 ms, leaving letters fade 180 ms; width
follows with the same spring. Reduced motion → instant swap.

### 1.2 Badge — `BBBadge`
Height 20, radius full (`rounded-4xl`), padding 8×2, `text-xs font-medium`, icon 12, gap 4. Variants same color table as
Button (`default`, `secondary`, `destructive`, `outline` = 1 px `--border` + `--foreground` text, `ghost`, `link`).
Signature: `BBBadge(_ textKey, variant: .outline, icon: BBIcon? = nil)`.

**"Manuale" badge** = `BBBadge("Manuale", variant: .outline)` shown in transaction rows when the category was set by hand
(`!isAuto`); on web hidden below `sm`, so on phone it is **not shown** in rows — show it only in the transaction detail.
**Auto badge** = `AutoOriginBadge` (§3.6), not a `Badge`.

### 1.3 Card — `BBCard` (+ `BBCardHeader`, `BBCardTitle`, `BBCardDescription`, `BBCardAction`, `BBCardContent`, `BBCardFooter`)
**Filled** `--card` background (#417: no ring, no shadow at rest), `--card-foreground` text, radius `rounded-xl`, vertical padding = gap = `--card-spacing` (16; `size: .sm` → 12). Header: grid, title `font-heading
text-base font-medium leading-snug` (sm: `text-sm`), description `text-sm --muted-foreground`, optional action pinned top
right. Footer: top border, `--muted @ 50%` background. Note: the current design trend in the app replaces cards with
"open sections" (`PanelSection`, `SectionTitle`, `SoftRow`) — use `BBCard` only where the web still does.

### 1.4 Text inputs — `BBTextField`, `BBTextArea`, `CurrencyInput`
- Input: height 32 (phone: text 16 to avoid iOS zoom; web uses `text-base` under `md`), radius-lg, 1 px `--input` border,
  transparent bg (dark `--input @ 30%`), padding 10×4, placeholder `--muted-foreground`; focus `--ring` border + 3 pt ring
  `--ring @ 50%`; disabled bg `--input @ 50%` (dark 80%) + 50% opacity; invalid colors per §0.4.
- TextArea: min height 64, auto-grow (`field-sizing-content`), padding 10×8.
- `CurrencyInput(value: Double?, onChange, currency, id?, ariaLabel?)`: static currency symbol (`text-xs
  --muted-foreground`) left of a numeric field; grouping/decimal separators from the **user locale**
  (`Intl.NumberFormat(locale).formatToParts(1234.5)`), max 2 decimals, negatives allowed, live-formatted while typing.
  Native: `TextField` with a custom formatter (iOS `FormatStyle` / Android `VisualTransformation`) — the keypad is
  `.decimalPad` / `KeyboardType.Decimal`; accept both `,` and `.` as decimal input and normalize to the locale separator.

### 1.5 Checkbox / Switch / Slider
- `BBCheckbox(checked: Binding<Bool>)`: 16×16, radius 4, border `--input`; checked = `--primary` fill + white `check` icon 14.
  Hit area extended 12 h / 8 v.
- `BBSwitch(isOn:, size: .default | .sm)`: track 32×18.4 (sm 24×14), thumb 16 (sm 12), checked track `--primary`,
  unchecked `--input` (dark `--input @ 80%`); thumb `--background` (dark: checked `--primary-foreground`, unchecked
  `--foreground`). **Do not use the platform `Toggle`/`Switch` styling** — draw this custom one (iOS default switch is
  51×31 and green). Thumb transition: transform, 150 ms default ease.
- `BBSlider(value: Binding<Double>, in: ClosedRange, step:)` (single or range): track 4 high, radius full, `--muted`;
  filled part `--primary`; thumb 12×12 circle `--background` with 1 px `--ring` border, pressed ring 3 pt `--ring @ 50%`;
  hit area +8 each side; thumb aligned to the edges (`thumbAlignment="edge"`). Used by the simulators (pension projection,
  debt extra/refinance, early repayment, analytics scenario controls, split slider) — values update **continuously** while
  dragging; heavy recomputation must be throttled (web uses `useDeferredValue`).

### 1.6 Select / Dropdown menu / Popover
- `BBSelect` trigger: like Input (h 32 / sm 28), chevron-down 16 `--muted-foreground`, placeholder `--muted-foreground`.
  Content = popover list; items `text-sm`, radius-md, padding 6×4, focused/pressed bg `--accent` + `--accent-foreground`,
  check indicator on the right. Native: iOS `Menu` with `Picker` semantics is acceptable **only** if it keeps the custom
  trigger; for long lists (category picker, currency picker) use a searchable sheet.
- `BBMenu` (dropdown-menu): same item style, `variant: .destructive` items in `--destructive` with bg `--destructive @ 10%`
  pressed; supports checkbox items, radio items, separators, labels, submenus (theme submenu). Native: SwiftUI `Menu` /
  Compose `DropdownMenu` restyled; on phone these are fine as platform context menus if colors follow tokens.
- `BBPopover`: `--popover` bg, ring `--foreground @ 10%`, radius-lg, shadow-md, padding 10 (header title `font-medium`,
  description `--muted-foreground`). Used by `InfoHint`, `WhatsNewChip`, transaction note. On phone use iOS
  `.popover` with `.presentationCompactAdaptation(.popover)` / Compose `Popup`; long content → sheet.

### 1.7 Dialog / sheet — `BBSheet`, `FormDialog`, `BBAlertSheet`
- **Overlay**: black @ 40%; fades in/out with the sheet timing.
- **Sheet (default `DialogContent` on phone)**: anchored to bottom, full width, top corners radius `rounded-2xl` (16),
  bottom corners 0, `--popover` bg, ring `--foreground @ 10%`, padding 16 horizontal, top padding 28 (room for the
  handle), bottom padding `max(20, safe-area-bottom)`, max height 92% of screen, content scrolls inside, gap 16.
  **Handle**: 36×4 capsule `--border`, 10 pt from top, centered; the 24 pt strip is the drag zone.
  **Motion**: enter slide-up full height, duration **280 ms**, easing `cubic-bezier(0.32, 0.72, 0, 1)`; exit 200 ms;
  no fade, no scale. Swipe-down dismisses. Native: iOS `.sheet` with `.presentationDetents([.large])`-like custom
  sheet is close but not identical (iOS card stack + dimming differ) → build `BBSheet` as a custom overlay presenter on
  both platforms, or use `presentationDetents` + `presentationCornerRadius(16)` + `presentationDragIndicator(.hidden)`
  + custom handle, and Material3 `ModalBottomSheet` with `shape = RoundedCornerShape(16,16,0,0)`, custom drag handle,
  `scrimColor = Black.copy(0.4f)`. Choose one approach and use it everywhere.
- **Header/Footer**: header column gap 6, left-aligned; title `font-heading text-base font-medium`; description
  `text-sm --muted-foreground`; footer = actions stacked **vertically reversed** on phone (primary on top, full width).
- **`FormDialog`** (`FormDialogContent`): full-screen on phone (no handle, no rounding), close button `x` 20 icon in a
  44×44 circle at top 12 / right 12, `--muted-foreground`, pressed bg `--muted`; content scrolls; gap 20. Transition:
  slide from bottom 24 pt + fade, 200 ms. `size: .default | .wide` only matters on tablet (max width 512 / 672).
- **`BBAlertSheet`** (AlertDialog): same bottom sheet on phone, padding 16, gap 16, optional media icon slot, title,
  description, actions (`AlertDialogAction` = BBButton default/destructive, `AlertDialogCancel` = outline). Use for every
  destructive confirmation (delete account, delete goal, reset investments, danger zone). Never use `UIAlertController` /
  `AlertDialog` platform defaults — the copy is long and styled.

```swift
func bbSheet<Content: View>(isPresented: Binding<Bool>, title: String? = nil, @ViewBuilder content: () -> Content) -> some View
func formDialog<Content: View>(isPresented: Binding<Bool>, closeLabel: String = "Chiudi", @ViewBuilder content: () -> Content) -> some View
func bbAlertSheet(isPresented: Binding<Bool>, title: String, description: String, confirmLabel: String,
                  confirmVariant: BBButtonVariant = .destructive, cancelLabel: String = "Annulla", onConfirm: () -> Void) -> some View
```
```kotlin
@Composable fun BBSheet(visible: Boolean, onDismiss: () -> Unit, title: String? = null, content: @Composable ColumnScope.() -> Unit)
@Composable fun FormDialog(visible: Boolean, onDismiss: () -> Unit, closeLabel: String = "Chiudi", content: @Composable ColumnScope.() -> Unit)
@Composable fun BBAlertSheet(visible: Boolean, title: String, description: String, confirmLabel: String,
  confirmVariant: ButtonVariant = ButtonVariant.Destructive, cancelLabel: String = "Annulla", onConfirm: () -> Unit, onDismiss: () -> Unit)
```

### 1.8 Toasts — `BBToast` (sonner)
One global `Toaster` in the root layout. Usage in the web: `toast.success(…)` (12 call sites), `toast.error(…)` (3),
`toast(…)` (3). Style: bg `--popover`, text `--popover-foreground`, 1 px `--border`, radius `--radius`, icon 16 at the
start: success `circle-check`, info `info`, warning `triangle-alert`, error `octagon-x`, loading `loader-circle`
(spinning). Sonner defaults to keep: position bottom-center on phone (sonner default is bottom-right; on narrow screens it
spans the width at the bottom), auto-dismiss **4000 ms**, stack of max 3 visible, swipe to dismiss, optional action
button. Native: build a single `ToastCenter` (observable queue) + overlay view; do not use Android `Snackbar` default
styling or iOS banners. API: `ToastCenter.show(.success, messageKey, action: ToastAction? = nil)`.

### 1.9 Separator / Label
`BBSeparator` 1 px `--border` (horizontal or vertical). `BBLabel`: `text-sm font-medium leading-none`, gap 8, 50% opacity
when its control is disabled.

---

## 2. Motion components (`components/motion`)

Global rules (from `MotionProvider` + `lib/motion/springs.ts`): respect Reduce Motion (iOS `accessibilityReduceMotion`,
Android `Settings.Global.ANIMATOR_DURATION_SCALE == 0` / `isReduceMotionEnabled`) → no translate/scale, keep fades.
Springs (tokens `motion.spring.*`): **snappy** k=420 c=34 m=0.8, **soft** k=260 c=28 m=1 (default), **bouncy** k=380 c=26 m=1.
SwiftUI: `.interpolatingSpring(mass:stiffness:damping:)`; Compose: `spring(dampingRatio = c / (2*sqrt(k*m)), stiffness = k/m)`
→ snappy ζ≈0.927 stiffness 525, soft ζ≈0.868 stiffness 260, bouncy ζ≈0.667 stiffness 380.

| Web | Native name | Behaviour |
|---|---|---|
| `AnimatedNumber` (NumberFlow) | `AnimatedNumber(value:format:locale:mutedTail:)` | Only changed digits roll, in the direction of change; < 600 ms; formatted with the shared number formatter. `mutedTail` = decimal separator, fraction and trailing currency symbol at **0.55 em** in `--muted-foreground`. iOS 17: `Text(value, format:).contentTransition(.numericText(value:))` per part; Android: per-character `AnimatedContent` with slide up/down. Screen readers read the full value. Reduced motion → no roll. Use **only** for key figures that change because of a user choice or new data (hero amounts, simulator results), never on first appearance. |
| `TextMorph` | `TextMorph(text:)` | see Button §1.1 |
| `AnimatedList` | `AnimatedList(items:)` | For short live lists (sync accounts, import results): insert = opacity 0→1, scale 0.94→1, y −8→0 with bouncy spring; others slide with snappy; exit fade+scale 0.96 in 150 ms. |
| `BlurText` | `BlurText(text:stagger:delay:)` | Word-by-word: opacity 0→1, blur 10→0, y 10→0, 600 ms `cubic-bezier(0.16,1,0.3,1)`, stagger 60 ms. Overview greeting only. Android < 12 has no blur → fade+translate only (acceptable deviation). |
| `TextShimmer` | `TextShimmer(text:)` | Looping highlight sweep across text while work is in progress (sync/import). Reduced motion → static text in `--text-2`. |

---

## 3. Shared domain components (`components/domain/shared` and cross-cutting)

### 3.1 `StatCard` (two copies — unify)
Web has `components/stat-card.tsx` (legacy, EUR hardcoded, `value` only) and `components/domain/stat-card.tsx`
(canonical). **Port only the canonical one.**
- Props: `label` (key), `value: Double`, `currency = "EUR"` (pass the user currency), `subtitle?`, `valueOverride?` (view
  shown instead of the formatted amount; tone still from `value`), `tone: auto | neutral | pos | neg` (auto: `value < 0`
  → neg else pos).
- Layout: `BBCard`; title `text-xs font-semibold uppercase tracking-wide --muted-foreground`; value `font-heading text-3xl
  font-medium tabular-nums` colored `--pos`/`--neg`/`--foreground`; amount formatted with **0 decimals**; subtitle
  `text-sm --muted-foreground`, 4 pt above.
```swift
struct StatCard: View { init(label: String, value: Double, currency: String, subtitle: String? = nil, tone: StatCardTone = .auto, valueOverride: AnyView? = nil) }
```
```kotlin
@Composable fun StatCard(label: String, value: Double, currency: String, subtitle: String? = null, tone: StatCardTone = StatCardTone.Auto, valueOverride: (@Composable () -> Unit)? = null)
```

### 3.2 `MoneyHero`
Hero amount (net worth, portfolio, liquidity): `AnimatedNumber` with currency format and `mutedTail` — "30.673" large,
",12 €" small and muted. When amounts are hidden shows `••••` (no animation). Sizes at call sites: `text-5xl` phone /
`text-6xl` tablet (net worth). `splitMoney(value, currency, locale)` = split `formatToParts` at the decimal separator — port
it as a pure function and unit-test (it.IT: `30673.12 EUR` → main `"30.673"`, tail `",12 €"`; en-GB → main `"€30,673"`,
tail `".12"`).

### 3.3 `SegmentedControl<T>`
Props: `options: [(value, labelKey)]`, `value`, `onChange`, `ariaLabel`, `stretch` (equal-width segments, full width).
Container `--muted` bg, **radius full** (#427), padding 4, gap 4. Segment min height 36 (phone), padding 12 h, `text-sm
font-medium`, inactive `--muted-foreground`, active `--foreground` on a sliding **pill** (`--background`, radius full, **no
shadow**) that moves with the **bouncy** spring. Used by view toggles; **time periods use `PeriodSelector` (§3.3a)**:
- `ExpensesPeriodSelector`: Mese · 3 mesi · Anno (inline, not stretched); `TransactionsTypeToggle`: Tutte · Uscite · Entrate (inline, beside «Da decidere»).
- `TitlePriceChart` periods: 1M · 3M · 6M · 1A · 5A · Max.
- Chart view toggles: "Totale | Per classe".
- `ManagementSwitch` (Categorie | Regole): pill variant — container radius full, `--muted`, items min-h 44, padding 20,
  `text-sm font-semibold`, active `--card` + shadow-xs.

### 3.3a `PeriodSelector<T>` (#408, decision `2026-10-17-selettore-del-periodo`)
The one time-period selector (Panoramica, Liquidità chart and Analisi, Investimenti, Performance, security chart, dividend
years, Analitiche). Presets on **one line that never wraps** (scrolls sideways as a last resort), each segment **44 pt** tall
and at least 44 wide on the phone, `--muted` pill container, `--background` pill for the active one (bouncy spring). With a
`custom` range the last segment is a **calendar icon** (`calendar-days` 16) instead of «Personalizzato»; it opens a bottom
sheet: title «Scegli le date» / «Scegli i mesi» (cardTitle), the two ends «Dal → Al» as boxes (radius lg, 1 pt border; the
end being picked has a `--primary` border and a 2 pt `--primary @ 20%` ring, placeholder «Tocca l'ultimo giorno»), a
**day calendar** (six Monday-first weeks, 44 pt cells, ends `--primary` filled with `--primary-foreground` semibold, days
between `--primary @ 12%` flat-joined, other-month days `--text-3`, out-of-bounds days 30% and not tappable; header «‹ Ottobre
2026 ›» whose title opens a **month grid** 3×4 to jump), or a month grid for month granularity (Analitiche), the reason a
range is not valid (`text-xs --neg`), and «Applica» (primary, 44, full width) above «Annulla» (ghost). It keeps its own draft:
closing without applying changes nothing. Tapping picks the first then the last day; a tap before the start moves the start.
The chosen range shows under the presets as a short label («3 mar – 17 ott»; year only when it differs) where the page does
not already write it. Logic: `CalendarRange` (BuddyBudgetKit / :core, tests `DS_periodCalendar_*`): `monthGrid`, `pick`,
`inDraft`, `span`, `outOfBounds`, `shortLabel`. Debug: `-BBPeriodOpen` / `--ez bbPeriodOpen true` opens the first sheet.
Native names: `PeriodSelector`, `PeriodCustom`, `PeriodRangePanel`, `RangeCalendar`, `MonthGrid`, `CalendarNav`.
Presets in use: `NetWorthPeriodSelector` 1M · 3M · 1A · Max; `InvestmentsPeriodSelector` 1M · 3M · YTD · 1A · Max + calendar.

### 3.3b `SimulationResult` (#411)
The answer of a simulator: a short label (`text-sm --text-2`), the result as **one big figure** (`typography.display`:
Hanken 36 medium, leading 1, tracking −0.025, tabular — never the condensed face) in `--foreground` / `--pos` / `--neg`, and
one optional line of context (`text-sm --text-2`, 4 pt above). Used by «Più ogni mese» and «Surroga» on loans and «Prima di
vendere» in Tasse. Native: `SimulationResult(label, value, tone, caption)`. The texts come from the domain layer
(`DebtsText.extraResult` / `refinanceResult` → `SimulationText(label, value, caption, positive)`): «Finisci prima di» + the
duration + «{fine} invece di {base}, e risparmi {interessi} di interessi.»; «Conviene: risparmi» (pos) / «Non conviene:
spenderesti in più» (neg) + «Al netto delle spese[, che rientrano in N mesi].» / «Tra interessi e spese.»; «Ti resta» +
the net amount above the sale breakdown (Phase 4R part 2).

### 3.4 `PeriodStepper`
‹ label › arrows (44×44, radius-xl, `--text-2`, disabled at the latest period with opacity .35) + centered label
(`font-heading text-lg font-medium`, min width 144, live region) + `SegmentedControl` Mese · 3 mesi · Anno. Period math
(`getPeriodRange`, `shiftReferenceDate`, `formatPeriodLabel`) is domain logic → see `domain/` specs.

### 3.5 Section scaffolding
| Web | Purpose | Visual |
|---|---|---|
| `SectionHeading` → native `SectionViewsHeading` | On the phone the **current view is the title** («Movimenti ⌄»), opening `SectionViewsSheet`; **no section name above it and no tabs** (#427); the section's yellow main action (`BBSunIconButton`) on the right. Used by Liquidità (4 views + «Categorie e regole», also on the Categorie screen with that view active), Investimenti (6 tabs, trailing: ghost `database` «Importazioni fatte», outline round `upload` «Importa», sun `+` «Registra operazione»), Pensione (5 tabs, only when a fund exists; otherwise title «Pensione» + subtitle) and Analitiche (Risposte / Obiettivi, trailing `Guida` outline sm or sun `+` «Nuovo obiettivo») | title `SECTION_TITLE` (display 36, → 28 when label > 12 chars); chevron 16 in a 28 circle `--muted`; 16 above the heading |
| `SectionViewsSheet` | Sheet listing views (icon 20, label `text-base font-medium`, description `text-sm --text-2`) | rows min-h 56, radius-xl, active bg `--muted`, icon `--primary`, trailing `check` |
| `SectionTitle` (liquidity), `overview/SectionHeading`, `PanelSection` (investments), `GoalSectionHeading`, `AnalyticsCard` → native `BBSection` | Open section header: **title in the display face (`SECTION_TITLE`, 36) with no icon** (#411/#427) + optional link «Label →» (`text-sm font-semibold --primary`, 44 target) | content 16 below; sections 32 apart |
| `CollapsibleSection` | Header button with chevron rotating 90°, summary when closed; open state persisted (`section-open:<id>`) | title `11px semibold uppercase tracking-wide` |
| `Disclosure` | Row-button with title/summary/chevron; content below when open | — |
| `BackLink` | "‹ Parent" above the title, 44 pt target, `text-sm font-medium --text-2` | Native: keep the in-content back link **and** the system back gesture |
| Year segments beside a title (`TitleSegments`) | Tasse «Quest'anno», Dividendi «Dividendi incassati», Operazioni: the year `SegmentedControl` sits on the title row (`PanelSection` action) while ≤ 3 options, else a scrolling row under the title | — |
| `SoftRow` → native `BBSoftRow` | Borderless row with soft bg (`--foreground @ 4%`), radius-2xl, min-h 56, padding 16×12, title `font-semibold` (16), hint `text-sm --text-2`, start/end slots; stacked 6 apart. **The default list row inside pages** (no thin rules between rows, #427) | — |

Scope colors used by headers before Phase 4R (icons are no longer drawn; the parameter is kept for call-site
compatibility): Liquidity `--swatch-teal`, Investments `--primary`, Goals road `--swatch-blue`.

**Phase 4R rules for every screen** (web #417/#427): no gradients (charts use flat fills), no shadows or rings at rest
(floating layers keep theirs), no tiny capitals (labels in sentence case, `overline` is 14 medium `--muted-foreground`),
cards filled instead of outlined, section headings in the display face without icons, no thin rules between rows or
sections inside pages (space or `SoftRow` instead; real tables, dialogs, form fields and sticky action bars keep rules),
pill buttons and controls, no icons in section tabs. Inputs (`SearchField`: 44, radius xl, `--card` with a 1 pt `--input`
border and a search icon) and charts' tooltips keep their borders.

### 3.5a Flags and the language chooser (#397, decision `2026-10-17-selettore-lingua`)
`BBFlag(code: IT | DE | GB, size: sm 14×10 | md 20×14 | lg 24×16)`: a 3:2 flag drawn by the app (never emoji), radius 3,
hairline ring `--foreground @ 15%`; flag colours are fixed in both themes; English uses the British flag (en-GB formats).
Sign-in: the language chooser sits **at the end of the foot links** (flag sm + name `text-xs --text-3`), not next to the
brand; its sheet rows show flag lg + name. Onboarding and Impostazioni › Aspetto e uso: the «Lingua» row shows the flag md
before the name, the list rows flag lg + name + preview.

### 3.5b Sign-in pages (#405)
`AuthScaffold` on the phone: `--card` surface, brand top left (logo 29 + «BuddyBudget» 18 bold), the title in the display
face (`AUTH_TITLE` 52 light, leading 0.95), lead `text-base --text-2`, fields 44 high, the main button **`sun`** (pill, 44,
full width), foot links with the language chooser at the end. The navy preview (`brand-navy`) is shown by the web only
from `lg` up, so phones have no navy ground.

### 3.6 Categorization badges and origin
- `AutoOriginBadge(source: regola | storico | assistente, confidence: Double?, compact: Bool)`: icon 14 + label
  ("Regola", "Le tue scelte", "AI"), `text-xs --text-2`; compact = icon only (Movements rows); full description is the
  accessibility label (and tooltip on web → long-press on native). Icons: regola `bookmark-check`, storico `history`,
  assistente `sparkles`.
- `SuggestionOrigin(suggestion, align)`: same icon + one sentence (`text-xs --muted-foreground`); confidence % only in the
  long-press tooltip ("Sicura al {0}%: dal {1}% l'app la mette da sola.").
- Rule labels: match type "Esatta"/"Contiene"; source "Appresa"/"Manuale".
- Uncategorized state: category text/picker border in `--neg` (`border-neg/40`).

### 3.7 Avatars, category colors, logos
- `AccountAvatar(color: SwatchColor, icon: AccountIcon, size = 16)` / `CategoryAvatar(color, icon, size = 16)`: 36×36 circle,
  bg/fg from the swatch map below, lucide icon at `size` (16) centered. Unknown icon → `wallet` (account) / `package`
  (category); unknown color → `slate`. Icon keys are stored in the DB as **legacy lucide kebab names** (`home`,
  `help-circle`, `alert-triangle`, `gamepad-2`…) — see `iconography-assets.md` for the key→asset table.
- `EmptyState` icon chips, `SectionTitle` chips, `InstrumentIcon` initials use the **oklab mix 16% over transparent** of a
  `--swatch-*` color: render as the swatch color at alpha 0.16 (visually equivalent on solid backgrounds).
- **Swatch colors** (`SwatchColor`, 48 values = 16 base + 16 `-light` + 16 `-dark`; only the 16 base are user-pickable,
  the variants come from automatic color distribution `POST /api/categories/distribute-colors`):

| Variant | Light theme bg / fg | Dark theme bg / fg | Dot (`COLOR_DOT`) | Chart color |
|---|---|---|---|---|
| base `X` | `X-100` / `X-600` | `X-900 @ 40%` / `X-400` | `X-500` (yellow `-400`, slate `-400`) | `--swatch-X` |
| `X-light` | `X-50` / `X-500` | `X-800 @ 40%` / `X-300` | `X-300` | `--swatch-X-light` |
| `X-dark` | `X-200` / `X-700` | `X-950 @ 60%` / `X-300` | `X-700` | `--swatch-X-dark` |

Exceptions (base `slate` only): light fg `slate-500` (not 600), dark bg `slate-800` **opaque** (not 900 @ 40%), dark fg
`slate-400`; dot `slate-400`. Yellow dot is `yellow-400`. Literal map: `components/domain/shared/color-swatches.ts`.
The space in amounts like "30.673,12 €" is U+00A0 (no-break space) — keep it in tests. Tailwind v4 palette (oklch, converted to **sRGB hex, gamut-clipped**; Tailwind v4 colors are defined
in oklch and some exceed sRGB — for exact parity use Display P3 on both platforms: `Color(.displayP3, …)` /
`Color(…, colorSpace = ColorSpaces.DisplayP3)`; the generator can emit both):

| color | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| red | #fef2f2 | #ffe2e2 | #ffc9c9 | #ffa2a2 | #ff6467 | #fb2c36 | #e7000b | #c10007 | #9f0712 | #82181a | #460809 |
| orange | #fff7ed | #ffedd4 | #ffd6a7 | #ffb86a | #ff8904 | #ff6900 | #f54900 | #ca3500 | #9f2d00 | #7e2a0c | #441306 |
| amber | #fffbeb | #fef3c6 | #fee685 | #ffd230 | #ffb900 | #fe9a00 | #e17100 | #bb4d00 | #973c00 | #7b3306 | #461901 |
| yellow | #fefce8 | #fef9c2 | #fff085 | #ffdf20 | #fdc700 | #f0b100 | #d08700 | #a65f00 | #894b00 | #733e0a | #432004 |
| lime | #f7fee7 | #ecfcca | #d8f999 | #bbf451 | #9ae600 | #7ccf00 | #5ea500 | #497d00 | #3c6300 | #35530e | #192e03 |
| green | #f0fdf4 | #dcfce7 | #b9f8cf | #7bf1a8 | #05df72 | #00c950 | #00a63e | #008236 | #016630 | #0d542b | #032e15 |
| emerald | #ecfdf5 | #d0fae5 | #a4f4cf | #5ee9b5 | #00d492 | #00bc7d | #009966 | #007a55 | #006045 | #004f3b | #002c22 |
| teal | #f0fdfa | #cbfbf1 | #96f7e4 | #46ecd5 | #00d5be | #00bba7 | #009689 | #00786f | #005f5a | #0b4f4a | #022f2e |
| cyan | #ecfeff | #cefafe | #a2f4fd | #53eafd | #00d3f2 | #00b8db | #0092b8 | #007595 | #005f78 | #104e64 | #053345 |
| blue | #eff6ff | #dbeafe | #bedbff | #8ec5ff | #51a2ff | #2b7fff | #155dfc | #1447e6 | #193cb8 | #1c398e | #162456 |
| indigo | #eef2ff | #e0e7ff | #c6d2ff | #a3b3ff | #7c86ff | #615fff | #4f39f6 | #432dd7 | #372aac | #312c85 | #1e1a4d |
| violet | #f5f3ff | #ede9fe | #ddd6ff | #c4b4ff | #a684ff | #8e51ff | #7f22fe | #7008e7 | #5d0ec0 | #4d179a | #2f0d68 |
| purple | #faf5ff | #f3e8ff | #e9d4ff | #dab2ff | #c27aff | #ad46ff | #9810fa | #8200db | #6e11b0 | #59168b | #3c0366 |
| pink | #fdf2f8 | #fce7f3 | #fccee8 | #fda5d5 | #fb64b6 | #f6339a | #e60076 | #c6005c | #a3004c | #861043 | #510424 |
| rose | #fff1f2 | #ffe4e6 | #ffccd3 | #ffa1ad | #ff637e | #ff2056 | #ec003f | #c70036 | #a50036 | #8b0836 | #4d0218 |
| slate | #f8fafc | #f1f5f9 | #e2e8f0 | #cad5e2 | #90a1b9 | #62748e | #45556c | #314158 | #1d293d | #0f172b | #020618 |

Note the **chart swatches** (`--swatch-*` in `globals.css`) are *different* hex values (Tailwind v3 palette, e.g.
`--swatch-blue #3b82f6`) from the avatar palette above (Tailwind v4, e.g. `blue-500 #2b7fff`). Keep both as the web does;
the token generator should emit `swatch.*` (charts) and `palette.<color>.<shade>` (avatars) separately.

- `MerchantLogo(name, logoPath?, size: sm 36 | md 44 | lg 56, fallback?, onRemoteLogo?)`: circle; while loading / on
  failure shows the first letter or digit of the name, uppercased (`·` if none) in `font-heading font-semibold`
  (`text-sm`/`text-base`/`text-xl`), on `--foreground @ 6%` with `--text-2` text, or the `fallback` (an icon, or a whole
  view: movement rows and the movement detail pass the **category avatar**, so a movement without a loaded logo shows its
  category, never an initial; once the logo loads the row adds the category as a 16 corner badge). When the image loads: **white tile in both themes** + 1 px `--border` ring, image inset 6/8/10 padding.
  Decorative (name always written next to it). After at least one remote logo is shown, the list must show `LogoCredit`
  ("Loghi forniti da Logo.dev", `text-xs --muted-foreground`, link to https://logo.dev — a Logo.dev free-plan condition).
- `InstrumentIcon(type, name, instrumentId?, size: xs 20 | sm 28 | md 36)`: rounded square (radius-md / radius-lg). Resolution
  order (port `resolveInstrumentIcon` 1:1, see `iconography-assets.md`): crypto → bundled SVG on white tile; stock → brand
  vector (simple-icons path in its brand hex) on white tile; ETF/ETC/fund of a known issuer (ETC since web #438) → issuer initials in the issuer
  swatch; otherwise name initials in the type swatch (`etf` blue, `azione` violet, `obbligazione` teal, `fondo` amber,
  `crypto` orange, `etc` slate). With `instrumentId`, stocks and known-issuer ETFs/funds also try the remote logo
  `/api/instruments/{id}/logo` (white tile when loaded; initials until then).

### 3.8 Status, feedback and empty/loading/error states
- `EmptyState(icon, title, description, primary?, secondary?, color = --swatch-teal, align: start | center)`: 44 circle with
  tinted icon 20, title `font-heading text-xl font-medium`, description `text-sm --text-2` (max width 448), actions 44 high
  (primary = default, secondary = ghost). No card around it.
- `LoadError(message, onRetry)`: alert box radius-xl, 1 px `--destructive @ 30%`, bg `--destructive @ 5%`, text
  `--destructive text-sm`, `Segnala questo problema` link (area `caricamento`, only inside the signed-in shell) + outline
  sm "Riprova" button.
- `PageError(error, onRetry, title, description, showReport)`: full-page: `font-heading text-2xl font-semibold` title,
  `text-sm --text-2` description, `font-mono text-xs --text-3` "Codice errore: {digest}", Retry button. Native: shown for
  unrecoverable screen errors; the "digest" is the server request id.
- `ProgressBar(state: none | indeterminate | determinate(value,max), label)`: 6 high, radius full, track `--muted`, fill
  `--primary` (width animates 300 ms); indeterminate = full bar `--primary @ 50%` pulsing.
- `StepProgress(index, count, label)`: "Passo X di N" `text-xs font-medium --muted-foreground` + N segments 4 high gap 6,
  `--border` track, filled segments `--primary` scaling from left with snappy spring. `StepStage` animates step changes:
  slide 14 pt + fade 160 ms (reduced motion: fade only); `StepActions`: "Indietro" + primary button row.
- **Loading skeletons**: blocks `--muted` with radius-md (text lines) / radius-xl (cards), pulsing opacity (Tailwind
  `animate-pulse`: 2 s, `cubic-bezier(0.4,0,0.6,1)`, opacity 1 → 0.5 → 1). Each screen's skeleton matches the final
  layout heights (CLS rule). Generic app skeleton: title 32×192, subtitle 16×288, hero block 176, two 256 blocks. Native:
  `BBSkeleton(width:height:radius:)` + per-screen skeleton composables; no shimmer gradient (web uses pulse).
- `SyncIsland` / `SyncProgressRing` / `PersonalImportIsland`: dark pill (`--island` token) floating top-center that expands
  into a card (bouncy spring) listing accounts with `AnimatedList`; ring 20×20, radius 9, stroke 3, track
  `--muted-foreground @ 30%`, progress `--foreground`, determinate fills with the soft spring, indeterminate = 28% arc
  spinning. Native: iOS can mirror it with a Live-Activity-like in-app overlay; Android same overlay composable.
- `WhatsNewChip`: `--primary` text with `sparkles` 14 that rotates in once, sweep highlight; tap → popover/sheet with
  title, summary, "Prova" and "Non mostrare più".
- `InfoHint(label) { text }`: 24 circle `info` 14 `--muted-foreground` → popover max width 288, `text-sm leading-relaxed`.
- `GoalProgress(progress, status)`: thin bar, `--primary`, amber (`--swatch-amber`) if late, `--pos` if reached.
- `DebtRing(fraction, label, caption, size = 112)`: SVG ring stroke 12 round cap, track `--muted`, progress `--primary`
  starting at 12 o'clock; label `font-heading` at 0.2×size, caption `--muted-foreground` at 0.105×size.
- `ValueBreakdownBar(paid, market, value)`: 12 high bar radius full on `--muted`; gaining: `--primary` (paid/value) +
  `--pos` (market/value); losing: `--primary` (value/paid) + `--neg @ 70%` (|market|/paid); legend dots 8 with labels
  "Pagato / Dal mercato" or "Vale oggi / Perso", amounts 0 decimals.
- `GainText(gain, pct?, currency)`: "+120,50 € · +4,5%", `--pos`/`--neg`, minus sign is U+2212 "−".
- `RiskLevelMeter(level, volatility…)`: big word in `--risk-1…4` color, 4-band scale green→red with a marker; color never
  the only signal (word + band name).

### 3.9 Lists and rows
- `MovementRow`: min-h 60, gap 14, avatar (category icon button or MerchantLogo) + description (`font-semibold`, 1 line,
  truncate) + meta line (`text-sm --text-2`: category · origin · account · "diviso"; uncategorized → `--neg font-medium`)
  + trailing amount (`text-sm font-medium tabular-nums`; income "+" in `--pos`, expenses "−" in `--neg` (web `movement-row`, 4R part 2; also the movement detail figure);
  transfers `--text-2` with "Escluso dai conteggi"). Tap opens actions (Split, Edit, Note). Day grouping headers from `lib/liquidity/day-groups`.
- `TransactionRow` (legacy list): date `formatShortDate`, inline `CategoryPicker` (size sm), merchant kind, "Manuale" badge.
- `AccountChips` (native `AccountTile` row): horizontal scroller (16 side inset), chips min-h 56 radius-2xl, border 1.5, active `--primary` border +
  `--primary @ 10%` bg, inactive transparent border + `--foreground @ 4%`; amount `font-heading text-base font-medium`
  0 decimals + name `text-sm --text-2` with `triangle-alert` 14 `--neg` when attention needed; "Tutti i conti" first;
  dashed "+ Conto" chip last.
- `CategoryPicker`: searchable list (accent-insensitive), "most used" first then grouped by spending group; keyboard
  navigable. Native: sheet with search field.
- `SplitSlider`: explanation text, quick buttons ÷2 ÷3 ÷4 (`computeSplitExcluded`), slider + amount field; commits on
  change (`excludedAmount`). Logic in `domain/` (split.ts).
- `PositionRow`, `OperationRow`, `SubscriptionRow`, `GoalRow`, `DebtsListCard` rows, `InsightRow`: standard row
  pattern = leading avatar/icon (36), title + meta, trailing amount/gain; use a shared `BBListRow(leading, title, subtitle,
  trailing)` internally so spacing is identical.
- `Sparkline(values, width = 84, height = 30, color = --swatch-teal)`, `TitleSparkline` (72×24, stroke 1.5, green/red),
  `AccountsTrend` (220×56): see `charts.md` §3.

### 3.10 Privacy mode (amount masking)
- Global preference `hideAmounts` (server-side user setting `PATCH /api/user/settings { hideAmounts }`, optimistic, reverted
  on failure). Toggle = eye / eye-off button (topbar / settings).
- When on: **every** `formatCurrency` returns `AMOUNT_MASK = "••••"` (4 × U+2022) — currency symbol included, no sign
  coloring change; `MoneyHero` renders the mask without animation; **charts are blurred** (`filter: blur(10px)`) and
  non-interactive (no tooltips). Percentages and counts are **not** masked.
- Native: `PrivacyStore` (observable, injected at the root) consulted by the shared `Formatter.currency(...)`; charts apply
  `.blur(radius: 10)` + `.allowsHitTesting(false)` (iOS) / `Modifier.blur(10.dp)` (Android 12+; below 12 draw a `--muted`
  placeholder with the mask) and disable scrubbing. Toggling re-renders all amounts (web remounts the subtree; native gets
  it for free through observation). Also hide amounts in the app switcher snapshot when privacy is on (iOS
  `scenePhase` overlay, Android `FLAG_SECURE` optional) — native-only improvement, flagged as a product decision.

### 3.11 Theme
- Choices `light | dark | system` (`ThemeSubmenu`: "Chiaro" `sun`, "Scuro" `moon`, "Sistema" `monitor`); default `system`.
  `ThemeToggle` (sun · switch · moon, or compact single icon) toggles explicitly between light/dark.
- Web stores the choice in localStorage (next-themes), i.e. per device. Native: persist per device (UserDefaults /
  DataStore), apply via `preferredColorScheme` / a `BBTheme(darkTheme = …)` wrapper. Charts and SVG tokens must switch too.

### 3.12 Navigation shell
- `BottomNav` (web decision `2026-10-17-barra-in-basso-a-capsula`): a **floating capsule** 64 high, inset 12 from the
  sides and the bottom (+ safe area), `--sidebar @ 90%` with blur (iOS material; Android near-opaque), 1 pt
  `--sidebar-border`, shadow-lg; screens scroll under it and leave 64 + 24 at the end. 4 primary tabs `/panoramica`,
  `/liquidita`, `/investimenti`, `/debiti` + "Altro". Tab: icon **24** + `11px font-medium` label (tracking −0.025); the
  active tab has a **light grey pill** (`--sidebar-accent`, inset 4 vertically) sliding with the snappy spring and its
  icon and label in `--sidebar-primary` (others `--sidebar-foreground @ 60%`). No badges (web #451). Not yellow: the
  yellow pill was rejected.
- `MobileTopbar` → native `BBScreen` top bar on **tab roots**: `--sidebar` surface with a 1 pt `--sidebar-border` bottom
  line, the brand centred (logo mark 24 + «BuddyBudget» Hanken 16 bold) and «Scrivici» on the right; the large page title
  (`PAGE_TITLE`, display 40; the Panoramica greeting 44) is in the content, 24 below the bar, with the page's actions on
  its right. Pushed screens: back chevron, actions on the right, title collapsing into the bar. Native: custom top bar,
  not `NavigationStack` large titles (they would diverge from Android).

---

## 4. Component catalogue (one line each)

Legend — **P**: primitive, **S**: shared, **D**: domain-specific (build when porting that screen).

| Web component | Kind | Native name | Notes |
|---|---|---|---|
| ui/button | P | BBButton | §1.1 |
| ui/badge | P | BBBadge | §1.2 |
| ui/card | P | BBCard… | §1.3 |
| ui/input, textarea | P | BBTextField, BBTextArea | §1.4 |
| ui/checkbox, switch, slider | P | BBCheckbox, BBSwitch, BBSlider | §1.5 |
| ui/select, dropdown-menu, popover | P | BBSelect, BBMenu, BBPopover | §1.6 |
| ui/dialog, alert-dialog, sheet-handle | P | BBSheet, BBAlertSheet, SheetHandle | §1.7 |
| ui/sonner | P | ToastCenter + BBToastView | §1.8 |
| ui/label, separator | P | BBLabel, BBSeparator | §1.9 |
| ui/chart (ChartContainer, ChartTooltipContent, ChartLegendContent) | P | BBChartContainer, BBChartTooltip | charts.md §1 |
| motion/* | S | AnimatedNumber, TextMorph, AnimatedList, BlurText, TextShimmer | §2 |
| domain/stat-card | S | StatCard | §3.1 |
| net-worth/money-hero | S | MoneyHero | §3.2 |
| shared/segmented-control (+ period selectors, toggles) | S | SegmentedControl | §3.3 |
| liquidity/period-stepper | S | PeriodStepper | §3.4 |
| shared/section-heading, section-tabs, section-views-sheet, back-link, collapsible-section; investments/panel-section, disclosure; liquidity/section-title, soft-row; overview/section-heading | S | same names | §3.5 |
| categorization/suggestion-origin, rule-labels | S | AutoOriginBadge, SuggestionOrigin | §3.6 |
| accounts/account-avatar, categories/category-avatar, shared/color-swatches | S | AccountAvatar, CategoryAvatar, SwatchColor | §3.7 |
| categorization/merchant-logo, logo-credit; investments/instrument-icon, instrument-label | S | MerchantLogo, LogoCredit, InstrumentIcon | §3.7 |
| shared/empty-state, load-error, page-error, progress-bar, step-flow, info-hint, form-dialog, inline-or-sheet | S | same names | §3.8, §1.7 |
| sync/sync-island, sync-progress-ring; personal-import/personal-import-island | S | SyncIsland, SyncProgressRing | §3.8 |
| whats-new/whats-new-chip | S | WhatsNewChip | §3.8 |
| goals/goal-progress, debts/debt-ring, investments/value-breakdown-bar, gain-text, risk/risk-level-meter | S | same | §3.8 |
| liquidity/movement-row, movement-item, movement-feed; expenses/transaction-row, split-slider; liquidity/account-chips; categories/category-picker | D/S | same | §3.9 |
| accounts/currency-input | S | CurrencyInput | §1.4 |
| liquidity/sparkline, trend-chart; overview/month-pace-chart; accounts/accounts-trend; titles/title-sparkline, mini-bars; income/month-bars; return-heatmap-grid; diversification/correlation-matrix, overlap-venn, world-dot-map | S | same (custom Canvas) | charts.md §3 |
| all recharts charts | D | see charts.md §2 | — |
| privacy-provider | S | PrivacyStore | §3.10 |
| theme-provider, theme-toggle, theme-submenu | S | ThemeStore, ThemeToggle, ThemeMenu | §3.11 |
| layout/bottom-nav, mobile-more-menu, mobile-topbar, app-shell | S | BottomNav, MoreMenu, TopBar, AppShell | §3.12 |
| categorization/swipe-card, swipe-deck, swipe-tour | D | SwipeDeck | Tinder-like categorization deck: drag card left/right/up; port gesture thresholds from `use-swipe-deck.ts` |
| analytics/* (tabs, scenario controls, glossary `Term`, `GlossedText`, explainers, walkthrough) | D | same | Hidden for DE; uses Slider + charts |
| debts/* (debt-extra-sim, debt-refinance-sim, early-repayment-compare, debt-plan-table) | D | same | Interactive simulators: logic in domain specs |
| pension/* | D | same | Hidden for DE |
| settings/* | D | same | Standard forms: SoftRow/Switch/Select |
| auth/* (login-panel, language-picker, currency-picker, legal consent) | D | same | Magic link + Google; native auth flow differs (see platform specs) |

## 5. Parity checklist for every component
1. Colors only from generated tokens (light + dark); no platform semantic colors (`.secondary`, `MaterialTheme.colorScheme`).
2. Fonts: bundle Hanken Grotesk, Space Grotesk, Geist Mono (the weights used: 400/500/600/700) — never fall back to
   SF/Roboto. Support Dynamic Type / font scale, scaling from the web base sizes (iOS `UIFontMetrics.scaledValue(for:)`,
   Android `sp`); verify layouts at the largest accessibility size.
3. Numbers: monospaced digits, minus sign U+2212 where the web uses it (`formatSigned*`), mask via PrivacyStore.
4. Touch targets ≥ 44 pt; visual sizes from this document.
5. Motion: only the springs/durations of `tokens.json` `motion.*`; Reduce Motion honored.
6. Every component has a snapshot test in both apps with identical fixtures (light/dark, it-IT/en-GB/de-DE, privacy on/off).
