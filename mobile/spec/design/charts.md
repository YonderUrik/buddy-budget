# Charts

Web: Recharts **3.8.1** through the shadcn `ChartContainer` (`components/ui/chart.tsx`) plus a set of hand-drawn SVG charts.
This document lists every chart that is **live** in the web app, the exact visual contract, and how iOS and Android render
it identically. Tokens are CSS variable names (`--primary` → `color.primary` in `design/tokens.json`); light/dark come
from the token file.

## 0. Global rules (apply to every chart)

1. **No entry animation.** All Recharts series use `isAnimationActive={false}`. Charts appear fully drawn. The only
   exception is `MonthPaceChart`: the "you" line draws once on open (stroke-dashoffset 1 → 0, **900 ms**,
   `cubic-bezier(0.16, 1, 0.3, 1)`, **150 ms delay**), skipped with Reduce Motion. Changing period/filter re-renders
   without tweening (the hero number above animates instead, via `AnimatedNumber`).
2. **Privacy mode** (`hideAmounts`): the whole plot is blurred (`blur(10px)`) and non-interactive; tooltips disabled.
   Native: blur radius 10 pt + hit testing off (Android < 12: replace the plot with a `--muted` placeholder of the same height).
3. **Accessibility**: each chart has a text summary (`sr-only` paragraph / `aria-label`), e.g. "Patrimonio netto
   nell'ultimo mese: da X a Y.". Native: `accessibilityLabel` on the chart container with the same catalog string;
   iOS may additionally expose `AXChartDescriptor`. The summary strings are in the i18n catalog.
4. **Formatting**: every label uses the shared formatters (`domain/formatting-localization.md`): currency with
   `maximumFractionDigits: 0` on axes and legends, 2 decimals in tooltips; percent axes `x.toLocaleString(locale,{max 1 dp}) + "%"`;
   signed percent with U+2212 minus; tooltip dates `{day: numeric, month: long, year: numeric}` ("3 marzo 2026").
5. **Tooltip box** (shadcn default and all custom ones): bg `--background` (analytics tabs use `--popover`), border
   1 px `--border @ 50%` (custom ones `--border`), radius `--radius-lg`, padding 10 × 6, `text-xs`, shadow-xl, min width
   128–176. Rows: label `--muted-foreground`, value `font-mono font-medium tabular-nums --foreground`, indicator 10×10
   radius 2 (or 8 circle) in series color.
6. **Axis text**: 12 px `--muted-foreground` (`fill-muted-foreground`), no tick lines, no axis lines (all charts set
   `tickLine={false} axisLine={false}`), `tickMargin` 8 where specified. Grid: horizontal lines only
   (`vertical={false}`), color `--border @ 50%` (shadcn rule) or `strokeOpacity 0.3`; dashed `3 3` or `2 4` where stated.
7. **Curves** (exact algorithms in §4):
   - Recharts `type="monotone"` = d3 `curveMonotoneX`.
   - **No `type`** (analytics charts: costs, simulation, timeline, withdrawal) = **linear**.
   - `type="stepAfter"` = horizontal then vertical step.
   - Hand-drawn `smoothPath` (TrendChart, Sparkline) = cubic with **horizontal tangents** (control points at mid-x).
8. **Hidden Y axis + padded domain**: hero charts hide the Y axis and use `domain = [min × 0.9, max × 1.01]` so the line
   fills the height. Others use `[0, auto]` (auto = nice-rounded max, §4.4).
9. **Width/height**: charts are full-bleed on phone (`-mx-4`), heights listed per chart (in pt/dp). Plot margins from
   Recharts default `{top 5, right 5, bottom 5, left 5}` unless the chart sets `margin`.

## 1. Interaction model (mobile)

Web uses hover (desktop) and tap (touch, Recharts shows the tooltip on touch and keeps it). Native unifies:

| Gesture | Effect |
|---|---|
| Touch down inside the plot | Show crosshair (vertical 1 px line `--border`, or `--muted-foreground` dashed `3 3` for ReturnsChart), active dot (r 4, series color, 2 pt `--background` ring) and tooltip at the **nearest x index** |
| Horizontal drag | Scrub: index follows the finger (`index = round(x / plotWidth × (n − 1))`, clamped) |
| Vertical drag | Scrolls the page (the chart only captures horizontal pans — web `touch-pan-y`) |
| Lift / cancel | Hide crosshair and tooltip (matches `TrendChart` `onPointerLeave/Cancel`) |
| Tooltip placement | Pinned at the top of the plot, horizontally centered on the scrub x, clamped so it never leaves the chart (web TrendChart clamps the center to 14%…86% of the width). Same rule for all charts on native (Recharts' "follow the cursor" placement is a desktop behaviour). |
| Haptics (native only) | Selection tick on each index change (`UISelectionFeedbackGenerator` / `HapticFeedbackType.TextHandleMove`). Product decision: keep or drop on both. |
| Donut slices | Tap = select/lock the slice (others dimmed to **0.35** opacity, center label switches to slice name/amount/share); tap the same slice again or outside = unlock. No hover state. |
| ReturnsChart range | Plain drag = scrub. **Long-press (350 ms) then drag** = range selection (`ReferenceArea` `--primary @ 12%`), release with from ≠ to applies `onSelectRange({from, to})` sorted; equal → no-op. (Web uses mouse-down-drag; this is the touch translation.) |
| Legend chips (NetWorth "Per classe") | Tap toggles a class (min height 44). The last visible class cannot be hidden (`toggleHiddenClass`). |

## 2. Recharts charts in use

Not ported (exported but **unused** in any route — dead code): `AccumulatedSavingsChart`, `CashflowTrendChart`
(components/domain/cashflow), `CategoryBreakdownDonut`, `ExpenseTrendChart` (components/domain/expenses),
`AccountsTrend` (accounts). Do not build them.

### 2.1 Net worth — `NetWorthChartCard` (Panoramica `/panoramica`)
Data: `NetWorthSeriesPoint[] { date: "YYYY-MM-DD", label, value, byClass: { liquidita, investimenti, previdenza, debiti }, isEstimated }`
(server-computed series, period `1mese|3mesi|1anno|max`, compact). Height 240. Hidden when < 2 points ("L'andamento
comparirà nei prossimi giorni.").
- **View "Totale"** (default): single `Area` monotone `value`, stroke `--primary` 2, fill vertical gradient `--primary`
  0.30 → 0.00; hidden axes; Y domain `[min×0.9, max×1.01]`; margin top 8, others 0; crosshair `--border`; active dot r 4.
- **View "Per classe"** (only if > 1 class): stacked `Area`s monotone, order bottom→top `liquidita` (`--swatch-teal`),
  `investimenti` (`--primary`), `previdenza` (`--swatch-slate`); stroke 1.5; gradient class color 0.40 → 0.08 (previdenza
  excluded from total: 0.22 → 0.05 and stroke dash `2 3`); `debiti` (`--neg`) is never stacked. Net line `Line` monotone
  `value` `--foreground` 2.5, shown when debts exist or pension is excluded. Grid dashed `2 4` `--border`; X axis labels
  `label`, 13 px, minTickGap 32, tickMargin 8; Y hidden; no crosshair.
- Tooltip (`NetWorthChartTooltip`): date (long) + " · stimato" if estimated; if > 1 class: one row per class top→bottom
  with 8 dot, name ("Debiti (già sottratti)" for debts), value (2 dp); then a total row (border-top) "Totale" / "Totale
  senza previdenza" / "Totale parziale".
- Legend (Per classe): pill buttons with color dot (hollow when hidden, label struck through), latest value 0 dp;
  "Mostra tutto" link when partial; notes "Linea scura: patrimonio netto", "Il patrimonio netto è già al netto dei debiti",
  "Area grigia: previdenza, non inclusa nel totale".
- Above: `MoneyHero` (48 pt) + change line `font-mono text-sm` with `trending-up/down` 16, `±amount (±pct)` in `--pos/--neg`
  + period phrase; under the chart: `NetWorthPeriodSelector`; optional switch "Includi la previdenza nel totale".

### 2.2 Net worth composition donut — `NetWorthCompositionRow` (Panoramica)
`PieChart` 192×192, one `Pie`, innerRadius 62, outerRadius 90, paddingAngle 2°, cornerRadius 4, no stroke. Slice colors =
asset class colors (2.1). Tap locks / dims others to 0.35. Center and side rows show the focused class. **Angles: Recharts
default startAngle 0 → endAngle 360 = starts at 3 o'clock and proceeds counter-clockwise** — native must replicate (do not
use the platform default 12 o'clock clockwise).

### 2.3 Spending by group donut — `CategoryDonut` (Liquidità, via `SpendByGroup`)
`size` prop (square). innerRadius = size × 0.69 × 0.5, outerRadius = size × 0.5 × 0.9, paddingAngle 2°, cornerRadius 4,
no stroke, start 3 o'clock counter-clockwise. Slice colors per group/category (`--swatch-*`). Center: total + `centerLabel`;
when a slice is focused: name, amount, share %. Focus is controlled by the parent so the rows next to it highlight too.

### 2.4 Portfolio value — `PortfolioHeroCard` (`/investimenti`)
Data: `{ date, label, value, invested, registered? }`. Height 240. Hidden axes, Y domain `[min×0.9, max×1.01]`, margin top 8.
- `Area` monotone `value`, `--primary` 2, gradient `--primary` 0.30 → 0, `dot` only when the series has 1 point, active dot r 4.
- `Line` **stepAfter** `invested` ("Versato"), `--muted-foreground` 1.5, dash `4 4`.
- `Line` monotone `registered` ("Valore registrato"), `--foreground` 1.5 — only while the cost simulation is active.
- Tooltip: date; "Valore {amount}"; "Versato {amount}" (muted); difference |value − invested| in `--pos`/`--neg`.
- Period: `PortfolioPeriodSelector` (1M/3M/YTD/1A/Max/Personalizzato).

### 2.5 Cumulative TWR — `ReturnsChart` (Investimenti → Rendimenti)
Data: `{ date, portfolio: ratio, benchmark: ratio | null }`. Height 256, margin left 4 right 8.
- Grid dashed `3 3`; X axis `date` formatted `{day numeric, month short, year 2-digit}`, minTickGap 36; Y axis visible,
  width 52, ticks `(v×100) {≤1 dp} %`; `ReferenceLine y=0` `--border`.
- `Line` monotone `portfolio` `--primary` 2 ("Portafoglio · TWR"); `Line` monotone `benchmark` `--swatch-amber` 1.5 if a
  benchmark is chosen.
- Crosshair `--muted-foreground` dashed `3 3`. Tooltip: date; "Portafoglio · TWR +x,x%"; "{benchmark} +y,y%" (muted).
- Scrub calls `onInspect(date)` (the card header shows the value at that date); range selection see §1.

### 2.6 Drawdown — `DrawdownChart` (Investimenti → Rischio)
Data: `{ date, label, drawdown ≤ 0 }`. Height 160 (`max-h-40`), margin left 4 right 8. Grid dashed `3 3`; X `label`
minTickGap 24; Y visible width 48, domain `[dataMin, 0]`, ticks percent with **1 decimal when the min > −5%** else 0
decimals. `Area` monotone `--neg` 1.5, gradient **inverted** `--neg` 0.05 (top) → 0.35 (bottom). Tooltip: date; "Al massimo"
when 0, else "−x,x% dal massimo".

### 2.7 Instrument price — `TitlePriceChart` (`/investimenti/titoli/[id]`)
Data: `{ date, close }` (thinned server-side), periods 1M/3M/6M/1A/5A/Max. Height 224 (tablet 288), full-bleed, margin
left 4 right 8. Color = `--pos` if last close ≥ first close (or < 2 points) else `--neg`.
- Grid dashed `3 3`; X `date` `{month short, year 2-digit}` with the "." removed, minTickGap 40; Y visible width 48,
  domain `[auto, auto]`, tick = value rounded to 2 dp, plain number (no currency).
- `Area` monotone `close` color 2, gradient color 0.25 → 0.
- If the user owns it: `ReferenceLine y=averagePrice` `--primary` dash `5 4` (extends domain); purchase markers
  `ReferenceDot` r 4.5 fill `--primary`, stroke `--background` 2, placed on the first chart point at/after the purchase date.
- Tooltip: date; price with `formatPrice` (4 dp when |v| < 10, else 2).

### 2.8 Analytics (Italy only; hidden for DE)
All: grid horizontal `strokeOpacity 0.3`, X axis `year` ticks `"{n}a"` (or calendar year), minTickGap 24–32, Y hidden,
**linear** curves (no `type`), tooltip `--popover` box with plain rows.

| Chart | Height | Series | Tooltip |
|---|---|---|---|
| `CostsTab` (Costi e tasse) | 224 | `withoutCosts` `--swatch-teal` 2 dash `4 3`; `withCosts` `--primary` 2; 30 years | "Tra {n} anni", "Senza costi:", "Con costi:", "Persi:" |
| `GrowthTab` (Crescita) | 256 | `BarChart stackOffset="sign"`: `fromSavings` `--primary`, `fromMarket` `--swatch-teal` stacked (negatives below 0) | label, "Dal risparmio:", "Da mercato e altro:", "Variazione totale:" |
| `SimulationTab` (Monte Carlo) | 256 | band `[p10,p90]` area `--primary` @ 0.12, band `[p25,p75]` @ 0.20 (no stroke), `p50` line `--primary` 2; Y domain `[0, auto]` | "Anno {n}" (+ " · inizio pensione"), "Sfortunato (10°):", "Tipico (mediana):", "Fortunato (90°):" |
| `TimelineSection` (FIRE) | 224 | `wealth` area `--primary` 2.5 fill 0.12; optional `baseline` line `--muted-foreground` 1.8 dash `4 4`; `ReferenceLine y=target` `--pos` dash `5 4` with label "Numero FIRE {amount}" inside-top-left 11 px `--pos`; Y domain `[0, max(max, target)×1.05]`; X = current year + n, minTickGap 32 | year, "Patrimonio:", "Ipotesi salvate:" |
| `WithdrawalTab` (Prelievi) | 224 | `p90` `--swatch-teal` 1.5, `p50` `--primary` 2, `p10` `--neg` 1.5; X `"{n+1}a"` | "Anno di pensione {n+1}", three percentiles |

### 2.9 Pension (Italy only; hidden for DE)
Common: Y hidden domain `[0, auto]` (yearly: auto), X padding 16 left/right, `PensionChartTooltip` (title + rows with 10×10
square indicator, label, value; min width 160 max 256).

| Chart | Height | Series |
|---|---|---|
| `PensionProjectionCard` (proiezione, with sliders years 1–45 default 25, quarterly contribution 0–3000 step 20) | 240 | band area under `optimistic` gradient `--primary` 0.20 → 0 (no stroke, not in tooltip); `optimistic` line `--swatch-teal` 1.5 dash `4 3`; `base` `--primary` 2.6; `prudent` `--swatch-slate` 1.5 dash `4 3`; all monotone; X `"{n}a"`; tooltip title "Tra {n} anni" |
| `PensionTrendChart` (andamento, hero) | 260 default | `netContributions` **stepAfter** area `--swatch-slate` 2, gradient 0.30 → 0; `value` monotone line `--primary` 2.6; X `label` minTickGap 36 |
| `PensionYearlyCard` | 240 | `BarChart stackOffset="sign"`: `contributions` `--primary` (square), `gainPos` `--pos` (top corners 4), `gainNeg` `--neg` (bottom corners 4); `ReferenceLine y=0` `--border`. Tooltip: "{year}" or "{year} (anno in corso)", Versato, Rendimento/Perdita (±), Rendimento % or "n.d.", footnote 11 px |

## 3. Hand-drawn charts (custom on both platforms)

These are SVG in the web and must be **custom Canvas/Path** on iOS and Android.

| Component | Where | Spec |
|---|---|---|
| `TrendChart` | Liquidità hero, Liquidità → Analisi | viewBox width 1000 stretched (`preserveAspectRatio=none`), height prop (default 260). y range padded 12% top/bottom: `toY(v) = h×0.88 − (v−low)/span × h×0.76`; x evenly spaced over `max(points, reference)` − 1 columns. Line = `smoothPath`, stroke color (default `--primary`) **2.6 non-scaling**, round join; area under the line to the bottom with gradient color 0.26 → 0; optional reference series ("Di solito") `--text-3` 2, dash `2 7`, round cap. Scrub: vertical line 1 px `--foreground @ 20%`, dot 14 with 2 px `--background` border, tooltip (`text-sm`): date (long, if label is a `YYYY-MM-DD`), value `font-heading font-medium`, "Di solito: {v}". < 2 points → `--muted @ 50%` rounded placeholder of the same height. |
| `MonthPaceChart` | Panoramica "Ritmo del mese" | width = container (min 240), height 200, pad `{top 22, right 64, bottom 28, left 8}`, `max = max(1, current…, typical…) × 1.12`; baseline 1 px `--border`; typical (cumulative average of previous months) polyline `--text-3` 2 dash `5 5`, end labels at x_end+6: amount 13 px `--text-2`, "di solito" 12 px `--text-3`; current polyline (straight segments) `--primary` 3, round caps/joins, draw-on animation (§0 rule 1); "today" marker at `(dayOfMonth, spentSoFar)` filled `--primary`. |
| `Sparkline` | Account rows (liquidità) | 84×30, `smoothPath`, y padded 2 px, stroke 2 round cap, default `--swatch-teal`; flat series → `span = 1`. < 2 values → nothing. |
| `TitleSparkline` | Watchlist, sidebar insights | 72×24, padding 2, polyline stroke 1.5 round, `currentColor` = `--pos` if up else `--neg`. |
| `MiniBars` | Title dividends / company sections | vertical bars, no axes, height ∝ value / max (min 3% for non-zero), negatives drawn as 0 with the amount in the bar title; label under each bar; color class passed (e.g. `--swatch-blue`). |
| `MonthBars` | Income months / forecast | 12 monthly bars, two stacked parts (e.g. net + withholding = gross); min height 3 for non-zero; label under each bar. |
| `ReturnHeatmapGrid` | Investimenti → Rendimenti | grid gap 3, 10 px labels; cell color = `--muted` if no data or level 0, else `--pos`/`--neg` mixed with `--muted` at `[0, 30, 50, 72, 100]%` (oklab) by level 1–4; day/week groupings scroll horizontally (min width `columns × 13 + 40`). Level computation is domain logic (`lib/calc/return-heatmap`). |
| `CorrelationMatrix` | Diversificazione | cells `color-mix(oklab, --neg (r ≥ 0) or --pos (r < 0) at strength%, --muted)`; null → `--muted`. |
| `OverlapVenn` | Diversificazione overlap pairs | two circles r 14, centre distance from 26 (share 0) to 3 (share 1); colors by level: alta/media `--swatch-amber`, bassa `--swatch-blue`. |
| `WorldDotMap` | Diversificazione → aree | precomputed dot rows (`scripts/generate-world-dot-map.mjs` output) cell 5, dot stroke 3.4 round; held areas colored by area color with opacity 0.6 → 1 as weight → 25%; non-held `--muted-foreground` @ 0.14; small areas get a ring r 9 stroke 1.2. Ship the same generated dot data as a JSON asset to both apps. |
| `DebtRing`, `SyncProgressRing`, `GoalProgress`, `ValueBreakdownBar`, `RiskLevelMeter`, `ProgressBar` | various | see `components.md` §3.8 |

Color mixing: `color-mix(in oklab, A p%, B)` must be computed in **OKLab** on native (convert both sRGB colors to OKLab,
lerp, convert back). Put `mixOklab(a, b, t)` in the shared design-system module with golden tests (e.g. `--pos` light
50% over `--muted` light), computed by a script from the web values.

## 4. Geometry contract (shared, unit-tested on both platforms)

### 4.1 `smoothPath` (horizontal-tangent cubic)
```
M p0
for i in 1..<n:  mid = (x[i-1] + x[i]) / 2
  C (mid, y[i-1]) (mid, y[i]) (x[i], y[i])
```
Coordinates rounded to 0.1 in the web string (irrelevant natively).

### 4.2 Monotone X (Recharts `monotone` = d3 `curveMonotoneX`, Steffen 1990)
For points sorted by x, `h_i = x_{i+1} − x_i`, `s_i = (y_{i+1} − y_i)/h_i`.
Interior tangent `t_i = (sign(s_{i−1}) + sign(s_i)) × min(|s_{i−1}|, |s_i|, 0.5 × |(s_{i−1} h_i + s_i h_{i−1}) / (h_{i−1} + h_i)|)` (0 if NaN).
End tangents: `t_0 = (3 s_0 − t_1)/2`, `t_{n−1} = (3 s_{n−2} − t_{n−2})/2`.
Segment i→i+1: cubic with `d = h_i/3`, controls `(x_i + d, y_i + d t_i)` and `(x_{i+1} − d, y_{i+1} − d t_{i+1})`.
2 points → straight line. Areas close the path down to the baseline (y of 0 or the domain min). Stacked areas use the
lower series' top as baseline (stack offset "none"; bars use "sign": positives stack upward from 0, negatives downward).

### 4.3 Step after
`M p0, then for each next point: H x_i, V y_i`.

### 4.4 Axis ticks and domains
- Y "auto"/nice ticks: Recharts `getNiceTickValues([min,max], tickCount = 5, allowDecimals = true)` (recharts-scale).
  Source: `node_modules/recharts/lib/util/scale/getNiceTickValues.js` (uses decimal.js-light; port with exact decimal
  arithmetic, ~100 lines). Golden vectors (computed by running that file, recharts 3.8.1, tickCount 5, allowDecimals true):

  | domain | ticks |
  |---|---|
  | `[0, 1234]` | `[0, 350, 700, 1050, 1400]` |
  | `[0, 87.5]` | `[0, 25, 50, 75, 100]` |
  | `[-3200, 5400]` | `[-6000, -3000, 0, 3000, 6000]` |
  | `[0.012, 0.087]` | `[0, 0.025, 0.05, 0.075, 0.1]` |
  | `[-0.153, 0]` | `[-0.16, -0.12, -0.08, -0.04, 0]` |

  Note the domain actually passed is the data extent after the chart's `domain` rule (`[0, auto]` → `[0, dataMax]`).
- X category labels: Recharts `interval="preserveEnd"` with `minTickGap` (default 5): walking **from the last tick
  backwards**, a label is drawn if its text box (measured with the axis font) does not overlap the previously drawn one
  plus `minTickGap`. The last label is always drawn.
- Bars: band = plotWidth / n; Recharts `barCategoryGap = 10%` → bar (or stack) width = band × 0.8, centered; grouped bars
  share that width with `barGap = 4`.
- Pie: angles start at 0° (3 o'clock) and go counter-clockwise; `paddingAngle` inserted between slices; `cornerRadius 4`.

### 4.5 Golden tests
Both apps run the same fixtures (`fixtures/charts/*.json`, to be generated from the web by a script that calls these
functions/recharts-scale): smoothPath control points, monotone control points, nice ticks, label thinning (with a fixed
fake text width function), stacked/sign offsets, OKLab mixes. Plus visual snapshot tests of each chart at 390 pt width,
light/dark, compared against web screenshots (Playwright, 390×844, same fixture data) with a perceptual diff threshold.

## 5. Native library choice

| Need | Swift Charts (iOS 17+) | Vico 2.x (Compose) | Custom Canvas |
|---|---|---|---|
| Line/area, gradient fill | ✅ `LineMark`/`AreaMark` + `.foregroundStyle(LinearGradient)` | ✅ `LineCartesianLayer` + area fill | ✅ |
| `monotone` curve identical to d3 | ⚠️ `.interpolationMethod(.monotone)` (algorithm undocumented; close but not guaranteed identical) | ❌ only `PointConnector.cubic(curvature)` — pairwise, cannot do monotone (it does give exactly the horizontal-tangent `smoothPath` with curvature 0.5) | ✅ §4.2 |
| stepAfter | ✅ `.stepEnd` | ⚠️ custom `PointConnector` (pairwise is enough for steps) | ✅ |
| Band (p10–p90) | ✅ `AreaMark(yStart:yEnd:)` | ⚠️ needs two areas / custom layer | ✅ |
| Stacked bars with sign offset, per-corner radius | ✅ (stacking by sign is automatic; `.cornerRadius` per mark is all corners → use `UnevenRoundedRectangle` via `.clipShape` workaround) | ⚠️ stacked columns ok, sign offset & per-corner radius need custom | ✅ |
| Reference line / dot / area | ✅ `RuleMark`, `PointMark`, `RectangleMark` | ✅ decorations/markers (limited labeling) | ✅ |
| Donut with paddingAngle + cornerRadius, 3-o'clock CCW start | ⚠️ `SectorMark(innerRadius:angularInset:)` + `.cornerRadius`, but start angle is 12 o'clock clockwise (needs rotation + mirroring) | ❌ no pie charts | ✅ |
| Scrub + pinned tooltip | ✅ `chartXSelection` (iOS 17) + `chartOverlay` | ✅ `CartesianMarker` (custom drawing needed) | ✅ |
| Axis label thinning identical to Recharts | ⚠️ automatic `AxisMarks` thinning differs; must pass explicit values | ⚠️ `HorizontalAxis.ItemPlacer` custom | ✅ |

**Recommendation**
- **iOS: Swift Charts** for all cartesian charts in §2 (2.1, 2.4–2.9), configured explicitly: hide default axes and pass
  computed tick values (§4.4), `.interpolationMethod(.monotone)` / `.linear` / `.stepEnd` per series, gradients and
  dashes from this spec, `chartXSelection` for scrubbing with a custom pinned tooltip in `chartOverlay`. If the monotone
  curve shows visible differences against the web snapshots, draw that series with a custom `Path` (§4.2) inside
  `chartOverlay`/`chartBackground` — Swift Charts keeps scales and selection.
- **Android: a small custom Compose Canvas chart kit (`bb-charts`)**, not Vico, because Vico cannot draw the d3 monotone
  curve, sign-stacked bars with per-corner radii, bands, or donuts, so most charts would need custom layers anyway. The kit
  needs only: linear X/Y scales, nice ticks, label thinning, line (linear/monotone/step/smooth), area (gradient, stacked,
  band), bars (stacked sign, rounded corners), reference line/dot/area, donut, crosshair + pinned tooltip, scrub gesture.
  Estimated 1.5–2k LOC. If the team prefers a library, Vico 2.x is acceptable for 2.5, 2.6, 2.7 only (simple lines/areas
  with `cubic(0.5)` ≠ monotone → visible difference on sharp turns; must be accepted explicitly).
- **Donuts (2.2, 2.3) and all §3 charts: custom Canvas on both platforms** (same geometry code, ported line-by-line).
- Alternative for maximum parity with less divergence risk: build the same custom kit on iOS too (SwiftUI `Canvas`) and
  skip Swift Charts entirely. Trade-off: lose Swift Charts' free accessibility (audio graphs) and some dev speed.

## 6. Parity checklist (per chart)
- [ ] Same data (server-computed series; never re-aggregate on the client unless `domain/` says so).
- [ ] Height, full-bleed margins, plot margins as specified; hidden axes stay hidden.
- [ ] Curve type per series (monotone / linear / stepAfter / smoothPath) — no defaults.
- [ ] Stroke widths, dash patterns (`4 4`, `4 3`, `5 4`, `2 3`, `2 7`, `3 3`, `5 5`), line caps/joins.
- [ ] Gradient stops (top/bottom opacities) and fill opacities exactly as listed; colors from tokens (light/dark).
- [ ] Y domain rule (`[min×0.9, max×1.01]`, `[0, auto]`, `[dataMin, 0]`, `[auto, auto]`, FIRE `×1.05`) and nice ticks.
- [ ] X label format, minTickGap thinning, last label preserved.
- [ ] Reference lines/dots/areas, labels and their colors.
- [ ] Tooltip content (rows, order, formats, colors), pinned placement and clamping.
- [ ] Scrub/lock/range gestures per §1; page still scrolls vertically.
- [ ] No entry animation (except MonthPace draw-on); Reduce Motion respected.
- [ ] Privacy blur, empty/insufficient-data state, accessibility summary string.
- [ ] Snapshot test light/dark × it/en/de vs web reference screenshots.
