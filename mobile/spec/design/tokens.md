# Design tokens

Single source of truth for colors, type, shape, spacing, elevation and motion in the BuddyBudget iOS (SwiftUI) and Android (Jetpack Compose) apps. Every value below was extracted from the web app (read-only reference):

| Source in web repo | What it defines |
|---|---|
| `app/globals.css` (`:root`, `.dark`, `@theme inline`) | All color tokens for light and dark, radius overrides, font-family bindings, custom effects (shimmer, AI surface, month-pace draw) |
| `node_modules/tailwindcss/theme.css` (Tailwind v4 defaults, not overridden) | Spacing unit, font sizes/line heights, weights, tracking, leading, shadows, default easings, breakpoints |
| `app/layout.tsx` (`next/font/google`) | Font families: Hanken Grotesk and Sofia Sans Extra Condensed (Phase 4R, web `0.81.0`; Space Grotesk and Geist Mono were dropped, web #417) |
| `lib/motion/springs.ts`, `lib/motion/sheet.ts`, `lib/motion/dialog-origin.ts`, `components/motion/*` | Springs, durations, sheet gesture thresholds |
| `components/ui/*` (shadcn `base-nova` style) | Control heights, paddings, radii actually used |
| `lib/validation/shared-colors.ts`, `lib/categories/groups.ts` | Category/account swatch palette and its persisted order, expense-group colors |

The machine-readable version is [`tokens.json`](./tokens.json) (254 tokens). **Generated code in both apps must come from `tokens.json`; never hand-copy hex values.** This document explains the tokens and the rules for using them.

## 0. Units and conventions

- **1 CSS px = 1 iOS pt = 1 Android dp.** All dimensions in `tokens.json` are in `pt` with that meaning. Font sizes are `pt` on iOS and **`sp` on Android** (so they follow the system font scale; see Dynamic Type below).
- **1 rem = 16 pt.** Tailwind spacing unit `--spacing` = 0.25 rem = **4 pt**; Tailwind class `p-3` = 12 pt.
- **Colors are sRGB hex**: `#RRGGBB`, or `#RRGGBBAA` when the token has alpha (alpha is the **last** byte, unlike Android's `0xAARRGGBB` — the generator must reorder).
- **No oklch in the token source.** The web palette is authored directly in hex (and a few `rgba()`); there is nothing to gamut-map. The only perceptual-space math in the web is `color-mix()` (Tailwind opacity modifiers and two custom mixes). Those were pre-computed into hex with an Oklab/Oklch implementation (CSS Color 4 matrices, results clipped to sRGB) and stored as `color.state.*` / `color.alpha.*` tokens. Round-trip check: mixing a color at 100% returns the original hex exactly.
- **Themes**: `light` and `dark`. The web follows the system theme by default (`next-themes`, `class="dark"` on `<html>`), with a manual override (System / Light / Dark) in Settings. Mobile must offer the same three-way setting and default to System.

## 1. Color

### 1.1 Semantic colors (shadcn roles + BuddyBudget additions)

Usage rules (from the web code):
- `background` is the screen background; `card` is the surface of every card/list group. Cards have **no border**: they use a 1 pt ring in `foreground` at 10% alpha (`color.alpha.foreground10`).
- `primary` (petrol blue) is an **accent only**: primary buttons, active nav item, focus ring, links, selected chips. Never a large surface.
- `foreground` / `text2` / `text3` are the three text levels. `mutedForeground` == `text2` in both themes; use `text3` for tertiary metadata.
- `pos` / `neg` color money: gains, income, positive deltas → `pos`; losses, expenses shown as negative, overdue → `neg`. `posSoft` / `negSoft` are translucent backgrounds for delta pills and banners.
- `destructive` equals `neg` in both themes; destructive buttons are *soft* (10% fill light / 20% dark, text in `destructive`), not solid.
- `highlight` is the brand "spreadsheet highlighter" yellow (login, selected cell).
- Brand colours (Phase 4R, web #405): `sun` is the **main action** of a page (`BBButton` variant `sun`, the round «Aggiungi» `BBSunIconButton`, the sign-in and onboarding primary button); `brandNavy` is the landing's navy ground (sign-in preview from `lg` up on the web; not shown at phone width). The active tab of the bottom bar is **not** yellow: a light grey pill (`sidebarAccent`) with `sidebarPrimary` icon and label (web decision `2026-10-17-barra-in-basso-a-capsula`, Daniele rejected the yellow pill).
- `secondary`, `muted`, `accent` share one value (neutral fill for secondary buttons, hovered/pressed rows, segmented controls).

| Token | CSS source | Light | Dark |
|---|---|---|---|
| `color.background` | `--background` | `#f7f7f8` | `#111113` |
| `color.foreground` | `--foreground` | `#18181b` | `#ececef` |
| `color.text2` | `--text-2` | `#52525b` | `#a1a1aa` |
| `color.text3` | `--text-3` | `#71717a` | `#80808a` |
| `color.card` | `--card` | `#ffffff` | `#18181b` |
| `color.cardForeground` | `--card-foreground` | `#18181b` | `#ececef` |
| `color.popover` | `--popover` | `#ffffff` | `#1f1f23` |
| `color.popoverForeground` | `--popover-foreground` | `#18181b` | `#ececef` |
| `color.primary` | `--primary` | `#15738b` | `#219ebc` |
| `color.primaryForeground` | `--primary-foreground` | `#ffffff` | `#0b0b0f` |
| `color.secondary` | `--secondary` | `#f0f0f2` | `#232327` |
| `color.secondaryForeground` | `--secondary-foreground` | `#18181b` | `#ececef` |
| `color.muted` | `--muted` | `#f0f0f2` | `#232327` |
| `color.mutedForeground` | `--muted-foreground` | `#52525b` | `#a1a1aa` |
| `color.accent` | `--accent` | `#f0f0f2` | `#232327` |
| `color.accentForeground` | `--accent-foreground` | `#18181b` | `#ececef` |
| `color.destructive` | `--destructive` | `#b0473b` | `#d2887b` |
| `color.border` | `--border` | `#e4e4e7` | `#2a2a2f` |
| `color.input` | `--input` | `#e4e4e7` | `#2a2a2f` |
| `color.ring` | `--ring` | `#15738b` | `#219ebc` |
| `color.pos` | `--pos` | `#2f7d57` | `#7bb79b` |
| `color.posSoft` | `--pos-soft` | `#2f7d571a` | `#7bb79b24` |
| `color.neg` | `--neg` | `#b0473b` | `#d2887b` |
| `color.negSoft` | `--neg-soft` | `#b0473b17` | `#d2887b24` |
| `color.highlight` | `--highlight` | `#fff3cf` | `#3a2f12` |
| `color.brandNavy` | `--brand-navy` | `#0b1c2a` | `#0b1b27` |
| `color.onBrandNavy` / `onBrandNavy2` | `--on-brand-navy(-2)` | `#f4f6f7` / `#a1a1aa` | same |
| `color.sun` / `sunHover` | `--sun` / `--sun-hover` | `#ffb703` / `#d99500` | same |
| `color.onSun` | `--on-sun` | `#18181b` | same |

### 1.2 Risk scale (1 = low → 4 = high)

Used by risk/volatility badges and the risk bar in Investments.

| Token | CSS source | Light | Dark |
|---|---|---|---|
| `color.risk.1` | `--risk-1` | `#2f7d57` | `#5bb98a` |
| `color.risk.2` | `--risk-2` | `#b89a1e` | `#d4b43c` |
| `color.risk.3` | `--risk-3` | `#d9731a` | `#ea8a3a` |
| `color.risk.4` | `--risk-4` | `#b0473b` | `#d8695c` |

### 1.3 Chart palette

`chart-1…5` is a monochrome green ramp. In light it goes dark→light, in dark it is inverted (light→dark) so `chart-1` is always the most prominent series against the background. See `design/charts.md` for which series takes which slot.

| Token | CSS source | Light | Dark |
|---|---|---|---|
| `color.chart.1` | `--chart-1` | `#1f5141` | `#7bb79b` |
| `color.chart.2` | `--chart-2` | `#2f7d57` | `#5fb98a` |
| `color.chart.3` | `--chart-3` | `#41705f` | `#5b9280` |
| `color.chart.4` | `--chart-4` | `#739688` | `#427060` |
| `color.chart.5` | `--chart-5` | `#b6c4bc` | `#2f4940` |

### 1.4 Expense groups (category types)

The four expense groups of a category (`dovuta` = must-pay, `voluta` = wanted, `futuro` = future-you/savings, `saltuaria` = occasional) plus the statistical bucket for uncategorized spend. Used for group dots, donut slices and stacked bars. Category types `entrata` (income) and `trasferimento` (transfer) have no group color.

| Token | CSS source | Light | Dark |
|---|---|---|---|
| `color.categoryGroup.dovuta` | `--group-dovuta` | `#dc2626` | `#f87171` |
| `color.categoryGroup.voluta` | `--group-voluta` | `#d97706` | `#facc15` |
| `color.categoryGroup.futuro` | `--group-futuro` | `#16a34a` | `#4ade80` |
| `color.categoryGroup.saltuaria` | `--group-saltuaria` | `#2563eb` | `#60a5fa` |
| `color.categoryGroup.uncategorized` | `--group-uncategorized` | `#94a3b8` | `#64748b` |

### 1.5 Swatch palette (category & account colors)

Each user category/account stores a **color key** (e.g. `"teal"`, `"blue-light"`), not a hex. The key maps to the swatch below. The palette is **identical in light and dark** (same hex in both blocks of `globals.css`).

- Only the **16 base keys (index 0–15)** are offered in color pickers, in this order.
- All **48 keys** are used by the automatic distribution (`distributeColors`, server-side): `SWATCH_COLORS[index % 48]`, skipping a color equal to the previous one. Order matters; it is in `tokens.json → $meta.swatchOrder`.
- Unknown/legacy key → fall back to `slate`.
- Category icon chips render the icon in the swatch color over a tint of the same color (see `design/components.md`).
- Some domain areas reuse swatches as section accents (Debts: interest = `amber`, plan = `teal`, events = `slate`, simulate = `violet`; ETF issuers in instrument avatars: iShares = `blue`, Vanguard = `rose`, Xtrackers = `teal`, SPDR = `violet`, Amundi = `orange`, Invesco = `emerald`, WisdomTree = `amber`, VanEck = `teal`).

| # | Key | Hex (both themes) | # | Key | Hex | # | Key | Hex |
|---|---|---|---|---|---|---|---|---|
| 0 | `slate` | `#94a3b8` | 16 | `slate-light` | `#cbd5e1` | 32 | `slate-dark` | `#334155` |
| 1 | `blue` | `#3b82f6` | 17 | `blue-light` | `#93c5fd` | 33 | `blue-dark` | `#1d4ed8` |
| 2 | `green` | `#22c55e` | 18 | `green-light` | `#86efac` | 34 | `green-dark` | `#15803d` |
| 3 | `yellow` | `#facc15` | 19 | `yellow-light` | `#fde047` | 35 | `yellow-dark` | `#a16207` |
| 4 | `purple` | `#a855f6` | 20 | `purple-light` | `#d8b4fe` | 36 | `purple-dark` | `#7e22ce` |
| 5 | `orange` | `#f97316` | 21 | `orange-light` | `#fdba74` | 37 | `orange-dark` | `#c2410c` |
| 6 | `red` | `#ef4444` | 22 | `red-light` | `#fca5a5` | 38 | `red-dark` | `#b91c1c` |
| 7 | `teal` | `#14b8a6` | 23 | `teal-light` | `#5eead4` | 39 | `teal-dark` | `#0f766e` |
| 8 | `pink` | `#ec4899` | 24 | `pink-light` | `#f9a8d4` | 40 | `pink-dark` | `#be185d` |
| 9 | `indigo` | `#6366f1` | 25 | `indigo-light` | `#a5b4fc` | 41 | `indigo-dark` | `#4338ca` |
| 10 | `cyan` | `#06b6d4` | 26 | `cyan-light` | `#67e8f9` | 42 | `cyan-dark` | `#0e7490` |
| 11 | `lime` | `#84cc16` | 27 | `lime-light` | `#bef264` | 43 | `lime-dark` | `#4d7c0f` |
| 12 | `amber` | `#f59e0b` | 28 | `amber-light` | `#fcd34d` | 44 | `amber-dark` | `#b45309` |
| 13 | `rose` | `#f43f5e` | 29 | `rose-light` | `#fda4af` | 45 | `rose-dark` | `#be123c` |
| 14 | `violet` | `#8b5cf6` | 30 | `violet-light` | `#c4b5fd` | 46 | `violet-dark` | `#6d28d9` |
| 15 | `emerald` | `#10b981` | 31 | `emerald-light` | `#6ee7b7` | 47 | `emerald-dark` | `#047857` |

### 1.6 Sidebar / navigation chrome

On mobile these tokens color the **bottom tab bar**, the top bar and the "More" sheet (web `bottom-nav.tsx` uses `bg-sidebar`, `border-sidebar-border`, active = `sidebar-primary`, badge = `sidebar-primary` on `sidebar-primary-foreground` with a 2 pt `sidebar` ring).

| Token | CSS source | Light | Dark |
|---|---|---|---|
| `color.sidebar.background` | `--sidebar` | `#ffffff` | `#16161a` |
| `color.sidebar.foreground` | `--sidebar-foreground` | `#18181b` | `#ececef` |
| `color.sidebar.primary` | `--sidebar-primary` | `#15738b` | `#219ebc` |
| `color.sidebar.primaryForeground` | `--sidebar-primary-foreground` | `#ffffff` | `#0b0b0f` |
| `color.sidebar.accent` | `--sidebar-accent` | `#f0f0f2` | `#232327` |
| `color.sidebar.accentForeground` | `--sidebar-accent-foreground` | `#18181b` | `#ececef` |
| `color.sidebar.border` | `--sidebar-border` | `#e4e4e7` | `#2a2a2f` |
| `color.sidebar.ring` | `--sidebar-ring` | `#15738b` | `#219ebc` |

### 1.7 "Island" (background jobs indicator)

A Dynamic-Island-like pill that shows running imports/syncs. **Always dark in both themes.** Inside the island, `foreground`, `mutedForeground`, `pos`, `neg` are remapped to the island variants.

| Token | CSS source | Light | Dark | Notes |
|---|---|---|---|---|
| `color.island.background` | `--island` | `#0f0f12` | `#0f0f12` | Always dark in both themes (not redefined in .dark). |
| `color.island.foreground` | `--island-foreground` | `#f4f4f5` | `#f4f4f5` | Always dark in both themes (not redefined in .dark). |
| `color.island.muted` | `--island-muted` | `#a1a1aa` | `#a1a1aa` | Always dark in both themes (not redefined in .dark). |
| `color.island.pos` | `--island-pos` | `#7bb79b` | `#7bb79b` | Always dark in both themes (not redefined in .dark). |
| `color.island.neg` | `--island-neg` | `#e3a194` | `#e3a194` | Always dark in both themes (not redefined in .dark). |

### 1.8 Derived colors (pre-mixed)

| Token | CSS source | Light | Dark | Notes |
|---|---|---|---|---|
| `color.state.secondaryHover` | `color-mix(in oklch, var(--secondary), var(--foreground) 5%)` | `#e4e4e6` | `#2b2b2f` | Pre-mixed by spec generator (Oklab/Oklch math, sRGB clip). |
| `color.state.aiButtonMid` | `color-mix(in oklab, var(--primary) 55%, var(--pos))` | `#217875` | `#52aaae` | Pre-mixed by spec generator (Oklab/Oklch math, sRGB clip). |

Gradients built from these:
- **AI surface** (Categorize screen card): border = `primary` at 30% alpha; fill = linear gradient 135° from `primary` @14% to `pos` @10%.
- **AI button**: linear gradient 110°: `primary` → `color.state.aiButtonMid` → `primary`, text `primaryForeground`; background slides 0%→100%→0% over 4 s ease-in-out, infinite (disabled with Reduce Motion).
- **Text shimmer** (in-progress labels): `mutedForeground` text with a moving `foreground` highlight band at 50%, 1.8 s linear loop. With Reduce Motion: plain `mutedForeground` text.
- **Text sweep once** ("New" label): same band in `primary`/`foreground`, 1.6 s, 2 iterations, 0.9 s delay.

### 1.9 Alpha variants

The web uses Tailwind opacity modifiers (`bg-primary/10`). In Tailwind v4 these compile to `color-mix(in oklab, <color> N%, transparent)`, which is exactly the color with alpha N%. `tokens.json` contains the variants actually used (`color.alpha.<token><N>`), e.g.:

| Token | Where | Light | Dark |
|---|---|---|---|
| `color.alpha.primary10` | selected chip / active row fill (most common tint) | `#15738b1a` | `#219ebc1a` |
| `color.alpha.primary5` | subtle highlighted card | `#15738b0d` | `#219ebc0d` |
| `color.alpha.muted50` | list row hover/pressed, skeletons | `#f0f0f280` | `#23232780` |
| `color.alpha.foreground10` | **card/popover ring** | `#18181b1a` | `#ececef1a` |
| `color.alpha.input30` | outline button & input fill (dark only) | — | `#2a2a2f4d` |
| `color.alpha.destructive10` / `20` | destructive button fill (light / dark) | `#b0473b1a` | `#d2887b33` |
| `color.alpha.ring50` | focus ring (3 pt) | `#15738b80` | `#219ebc80` |

Rule for native code: apply alpha with `Color.opacity()` / `Color.copy(alpha=)` on the base token **or** use the generated alpha token — never introduce a new hex.

### 1.10 Third-party fixed colors (not themed)

- Google sign-in logo: `#4285F4`, `#34A853`, `#FBBC05`, `#EA4335` (use the official asset instead).
- PWA manifest `theme_color`/`background_color`: `#ffffff`; browser chrome: `#f7f7f8` (light) / `#111113` (dark) = `background`. On mobile the status bar/navigation bar should use `background` of the current theme.
- Transactional email template uses its own copy of the palette (out of scope for apps).

## 2. Typography

### 2.1 Families

Re-exported from web `0.81.0` (`9a769fa5`) in Phase 4R (decisions `2026-10-17-landing-navy-dopo-hermes`, `2026-10-17-taste-skill`): **two faces only**.

| Token | Family | Role | Web usage | License |
|---|---|---|---|---|
| `font.family.sans` | **Hanken Grotesk** | Everything except titles: body, labels, buttons and **every figure** (`font-heading` is now an alias of Hanken with `tabular-nums`) | `font-sans`, `font-heading` | SIL OFL 1.1 |
| `font.family.display` | **Sofia Sans Extra Condensed** | Page and section titles only (`PAGE_TITLE`, `SECTION_TITLE`, `AUTH_TITLE`): light (300), leading 0.95. Never figures | `font-display` | SIL OFL 1.1 |
| `font.family.mono` | platform monospace (`system: true`, nothing bundled) | Literal codes only (error references, raw import lines) | `font-mono` = `ui-monospace` | — |

Both bundled faces come from Google Fonts as variable fonts; the apps ship **static instances** (`scripts/make-static-fonts.py`): Hanken Grotesk 400/500/600/700, Sofia Sans Extra Condensed 300/400.
- iOS: `.ttf` files in `Resources/Fonts`, listed under `UIAppFonts`, used with `Font.custom(_:size:relativeTo:)` so Dynamic Type still scales. The system role renders `Font.system(…, design: .monospaced)`.
- Android: `res/font/*.ttf` in a `FontFamily` per role; the system role is `FontFamily.Monospace`.
- `gen-tokens.mjs` deletes font files and OFL texts of dropped families from both apps. The OFL texts ship in the apps (`Resources/Fonts/*-OFL.txt`, `assets/licenses/*-OFL.txt`).

### 2.2 Numbers

- **Tabular figures everywhere an amount, percentage or date can change or line up** (`tabular-nums`, 284 uses). iOS: `.monospacedDigit()`; Android: `fontFeatureSettings = "tnum"`. Bake it into every `typography.*` token with `tabularNums: true`, and into all amount components regardless of style.
- Hero amounts use a **muted tail**: decimals, decimal separator and a trailing currency symbol are rendered at **0.55 em** in `mutedForeground` (`AnimatedNumber mutedTail`). Example: `2.480`**`,00 €`** with the tail smaller and muted.
- Negative numbers use the true minus sign `−` (U+2212) and an explicit `+` for positive deltas (see `domain/formatting-localization.md`).

### 2.3 Scale (Tailwind v4 defaults, unchanged)

| Token | Size (pt/sp) | Line height | Uses in web |
|---|---|---|---|
| `font.size.xs` | 12 | 16 | 425 |
| `font.size.sm` | 14 | 20 | 786 (default text inside cards) |
| `font.size.base` | 16 | 24 | 55 |
| `font.size.lg` | 18 | 28 | 53 |
| `font.size.xl` | 20 | 28 | 37 |
| `font.size.2xl` | 24 | 32 | 37 |
| `font.size.3xl` | 30 | 36 | 23 |
| `font.size.4xl` | 36 | 40 | 6 |
| `font.size.5xl` | 48 | 48 | 11 |
| `font.size.6xl` | 60 | 60 | 3 |
| `font.size.px9…px15` | 9, 10, 11, 13, 15 | inherit (use 1.333×, rounded to even) | ad-hoc `text-[11px]` (21), `text-[10px]` (12), `text-[15px]` (9) — axis labels, chips, nav badges |

Weights: `normal` 400, `medium` 500 (dominant: 506 uses), `semibold` 600 (157), `bold` 700 (6, nav badge counts only).
Tracking: `tight` −0.025 em (large headings), `wide` +0.025 em (uppercase overlines), `wider` +0.05 em, `widest` +0.1 em. Leading multipliers: tight 1.25, snug 1.375, normal 1.5, relaxed 1.625.

### 2.4 Semantic text styles (`typography.*` in tokens.json)

| Style | Family | Size / LH | Weight | Extra | Where |
|---|---|---|---|---|---|
| `pageTitle` | display | 40/38 | 300 | leading 0.95 | `PAGE_TITLE` screen titles (the Panoramica greeting is 44, sign-in titles `AUTH_TITLE` 52) |
| `sectionTitle` | display | 36/34 | 300 | leading 0.95 | `SECTION_TITLE` section headings, empty states, step forms; **no icon next to it** (#427); view titles over 12 characters drop to 28 |
| `display` | sans | 36/36 | 500 | tabular, −0.025 em | `SimulationResult` figure (#411) |
| `statValue` | sans | 30/36 | 500 | tabular | StatCard value |
| `amountLarge` | sans | 24/32 | 500 | tabular | card amounts |
| `cardTitle` | sans | 16/22 | 500 | | CardTitle (14 pt for `size=sm` cards), sheet titles |
| `body` | sans | 14/20 | 400 | | default text |
| `bodyLarge` | sans | 16/24 | 400 | | long text; **text fields on mobile** |
| `bodyStrong` | sans | 14/20 | 500 | | list primary line, labels |
| `caption` | sans | 12/16 | 400 | | metadata (`mutedForeground`) |
| `overline` | sans | 14/20 | 500 | **sentence case** (#417: no tiny capitals) | figure labels (StatCard, hero labels) in `mutedForeground` |
| `micro` | sans | 11/16 | 500 | | chips, axis ticks, tab bar labels |
| `badge` | sans | 12/16 | 500 | | Badge |
| `button` | sans | 14/20 | 500 | | Button (sm: 12.8, xs: 12) |
| `mono` | system mono | 12/16 | 400 | | literal codes only |

The voice sentences (Panoramica, Movimenti, Analisi) are `text-lg leading-relaxed` = Hanken 18/29 in `text2`, strong parts Hanken 500 in `foreground`.

**Dynamic Type / font scale**: the web has no equivalent, but native apps must honor it. Map each style to a text-style anchor (`relativeTo:` on iOS: display/pageTitle → `.largeTitle`, statValue/amountLarge → `.title`, sectionTitle → `.title3`, cardTitle → `.headline`, body/bodyStrong → `.subheadline`, bodyLarge → `.body`, caption/overline/badge/micro → `.caption`), and use `sp` on Android. Golden screenshot tests run at the default scale (iOS "Large", Android 1.0).

## 3. Shape (radii)

`globals.css` overrides the Tailwind radius scale with absolute values (there is no `calc()` left: every `--radius-*` is a literal px value):

| Token | Value | Web class | Used for |
|---|---|---|---|
| `radius.sm` | 6 | `rounded-sm` | small tags, checkbox |
| `radius.md` | 8 | `rounded-md` | small buttons (`xs`: min(md,10)=8; `sm`: min(md,12)=8), menu items |
| `radius.lg` | 11 | `rounded-lg` (= `--radius`) | **buttons, inputs, selects, popovers, menus, chart tooltip** |
| `radius.xl` | 16 | `rounded-xl` | **cards, dialogs, list rows in sheets** |
| `radius.2xl` | 18 | `rounded-2xl` | hero cards |
| `radius.3xl` | 20 | `rounded-3xl` | large panels |
| `radius.4xl` | 24 | `rounded-4xl` | **badges** (fully rounded at 20 pt height) |
| `radius.full` | capsule | `rounded-full` | avatars, pills, nav badges, progress bars |

Corner style: the web draws circular corners. For pixel parity use `RoundedRectangle(cornerRadius:style: .circular)` on iOS and `RoundedCornerShape` on Android (also circular). Do not switch iOS to `.continuous` unless both platforms change together.

## 4. Spacing

Tailwind 4 pt grid. Values actually used (by frequency): 8 (`2`), 12 (`3`), 6 (`1.5`), 4 (`1`), 16 (`4`), 24 (`6`), 2 (`0.5`), 20 (`5`), 10 (`2.5`), 32 (`8`), 40 (`10`). `tokens.json` exposes `space.0 … space.24` as `space.<tailwindStep>` with `.` replaced by `_` (`space.1_5` = 6 pt).

Component metrics (`layout.*`):

| Token | Value | Source |
|---|---|---|
| `layout.cardPadding` / `cardPaddingSm` | 16 / 12 | Card `--card-spacing` (also the vertical gap between header/content) |
| `layout.buttonHeight` (default) | 32 | Button `h-8`; `sm` 28, `xs` 24, `lg` 36; icon buttons are square |
| `layout.inputHeight` | 32 | Input `h-8`, horizontal padding 10 |
| `layout.badgeHeight` | 20 | Badge `h-5`, padding 8 |
| `layout.iconSize` | 16 | default icon in buttons (`sm` 14, `xs` 12) |
| `layout.bottomNavHeight` | 64 | the floating capsule (`BOTTOM_NAV_BAR_REM = 4`), inset `layout.bottomNavInset` = 12 from the sides and the bottom (+ safe area); screens leave 64 + 24 at the end and scroll under it |
| `layout.periodSegmentHeight` | 44 | `PeriodSelector` presets on the phone (`min-h-11`) |
| `layout.controlHeight` | 36 | `SegmentedControl` segment (`min-h-9`) |
| `layout.topBarHeight` | 56 | mobile top bar `h-14` |
| `layout.minTouchTarget` | 44 | `min-h-11` in mobile menus |
| `layout.dialogMaxWidth` | 448 | Dialog `max-w-md`, padding 24, gap 16 |
| `layout.popoverWidth` | 288 | Popover `w-72` (desktop) |
| `layout.navBadgeSize` | 18 | unread count on tab bar items, 10 pt bold |

**Mobile touch-target rule**: the web's 32 pt buttons are desktop-dense. Native controls keep the **visual** size from tokens but must have a **hit area ≥ 44 pt (iOS) / 48 dp (Android)** (`contentShape` + padding / `Modifier.minimumInteractiveComponentSize()`).

## 5. Elevation and borders

**Nothing at rest has a shadow or a ring (#417).** Cards are **filled** (`--card`, no ring); rows inside a page sit on a soft fill (`foreground` @ 4%, radius 2xl, `SoftRow`) and are separated by space, not thin rules (#427; real tables, dialogs, form fields and sticky action bars keep their rules). The **1 pt ring in `foreground` @ 10%** (`elevation.ring`) and the shadows below are only for floating layers: popovers, dialogs, sheets, toasts, chart tooltips, the floating bottom bar (shadow-lg). Charts use **flat fills** (area `fillOpacity` 0.12, stacked bands 0.22), no gradients. Tailwind v4 defaults (black, same in both themes):

| Token | Layers (x, y, blur, spread, color) | Used by |
|---|---|---|
| `shadow.xs` | 0 1 2 0 `#0000000d` | inputs (rare) |
| `shadow.sm` | 0 1 3 0 `#0000001a` + 0 1 2 −1 `#0000001a` | raised chips |
| `shadow.md` | 0 4 6 −1 `#0000001a` + 0 2 4 −2 `#0000001a` | popover, select, dropdown |
| `shadow.lg` | 0 10 15 −3 `#0000001a` + 0 4 6 −4 `#0000001a` | dialog, bottom sheet |
| `shadow.xl` | 0 20 25 −5 `#0000001a` + 0 8 10 −6 `#0000001a` | chart tooltip |

Native: SwiftUI `.shadow` supports one layer → apply two `.shadow` modifiers; spread is unsupported (approximate by reducing radius by |spread|). Compose `Modifier.shadow(elevation)` is not CSS-like; use `Modifier.dropShadow` (Compose 1.9+ `Shadow(radius, spread, offset, color)`) to match, else map md→3 dp, lg→8 dp, xl→12 dp elevation. Focus rings: 3 pt `color.alpha.ring50` outside the control (only visible with hardware keyboard / accessibility focus on mobile).

Scrim (backdrop) behind dialogs and bottom sheets: `#000000` @ **40%** (`bg-black/40`), same in both themes, fading in/out over 100 ms; alert dialogs (confirmations) use a lighter `#000000` @ **10%**. On wide screens (≥ 640) the web adds a 4 pt backdrop blur; phones get no blur. Tokens: `color.scrim.dialog`, `color.scrim.alert`.

## 6. Motion

### 6.1 Springs (the primary motion vocabulary)

Defined in `lib/motion/springs.ts` with mass-spring-damper parameters; the web's default transition for every `motion` animation is **soft**. Native APIs accept the same physics:

| Token | stiffness | damping | mass | damping ratio ζ | settles in | Use |
|---|---|---|---|---|---|---|
| `motion.spring.snappy` | 420 | 34 | 0.8 | 0.927 | ~483 ms | selection indicators, moving letters, list reorder |
| `motion.spring.soft` (default) | 260 | 28 | 1 | 0.868 | ~533 ms | content entering, text |
| `motion.spring.bouncy` | 380 | 26 | 1 | 0.667 | ~417 ms | segmented/tab pill, job island, list item enter |
| `motion.spring.dialogOpen` | 320 | 30 | 1 | 0.839 | ~450 ms | dialog grows from the tapped element |
| `motion.spring.sheetSnapBack` | 420 | 34 | 1 | 0.830 | ~417 ms | sheet returns after a short drag |

- iOS: `Animation.interpolatingSpring(mass: m, stiffness: k, damping: c, initialVelocity: 0)` — identical equation.
- Android: `spring(dampingRatio = ζ, stiffness = k / m)` (Compose assumes mass 1, so divide stiffness by mass: snappy → 525).
- ζ = c / (2·√(k·m)); "settles in" is the web's `springEasing` simulation (60 fps, rest when |x−1| < 0.0015 and |v| < 0.01).

### 6.2 Durations and easings

| Token | ms | Use |
|---|---|---|
| `motion.duration.instant` | 100 | popover/menu/dialog fade+zoom (95%→100%) in/out |
| `motion.duration.fast` | 150 | default color/opacity transitions; list item exit (scale 0.96 + fade) |
| `motion.duration.quick` | 160 | dialog opacity when growing from origin |
| `motion.duration.sheetExit` / `leave` | 180 | sheet dismiss (ease-in), text-morph letter leave |
| `motion.duration.base` | 200 | section transition: fade + slide up 4 pt, ease-out |
| `motion.duration.enter` | 260 | text-morph letter enter (+60 ms delay), ease-out |
| `motion.duration.slow` | 300 | upper bound for any UI transition |
| `motion.duration.numberMax` | 600 | upper bound for animated numbers; BlurText reveal (600 ms, expoOut, 60 ms stagger) |
| `motion.duration.monthPaceDraw` | 900 | month-pace line draws once on first appearance, +150 ms delay, expoOut |
| `motion.duration.shimmerLoop` | 1800 | text shimmer loop (linear) |
| `motion.duration.aiSheenLoop` | 4000 | AI button gradient loop (ease-in-out) |

| Easing token | cubic-bezier | Note |
|---|---|---|
| `motion.easing.standard` | 0.4, 0, 0.2, 1 | Tailwind default transition timing |
| `motion.easing.in` / `out` | 0.4,0,1,1 / 0,0,0.2,1 | Tailwind `ease-in` / `ease-out` |
| `motion.easing.cssEase` | 0.25, 0.1, 0.25, 1 | CSS `ease` (tw-animate enter/exit default) |
| `motion.easing.cssEaseIn` / `cssEaseOut` | 0.42,0,1,1 / 0,0,0.58,1 | CSS keywords used by WAAPI calls (sheet exit, text-morph) |
| `motion.easing.expoOut` | 0.16, 1, 0.3, 1 | BlurText, month-pace draw |

iOS: `Animation.timingCurve(x1, y1, x2, y2, duration:)`. Android: `tween(durationMillis, easing = CubicBezierEasing(x1, y1, x2, y2))`.

### 6.3 Motion rules (from the web performance standard)

- Transitions < 300 ms, number animations < 600 ms. **No entrance animation on charts** and none on first appearance of data or on long lists; animate only what communicates a change.
- **Animated numbers** (NumberFlow): only key figures that change because of a user choice or new data; digits roll individually in the direction of change.
- **Reduce Motion** (`UIAccessibility.isReduceMotionEnabled` / `Settings.Global.ANIMATOR_DURATION_SCALE == 0` or `LocalAccessibilityManager`): no translation/scale/springs — keep cross-fades only; shimmer/sheen effects become static.
- Bottom sheet gesture: drag from the handle or header; dismiss when dragged > **80 pt** or released faster than **0.6 pt/ms** (600 pt/s); otherwise snap back with `sheetSnapBack`. Exit = translate to 100% in 180 ms ease-in. Max height 85% of the screen.
- Haptics are not defined by the web; see `design/components.md`.

## 7. Breakpoints and adaptive layout

| Token | pt | Web meaning |
|---|---|---|
| `breakpoint.sm` | 640 | below: dialogs, popovers and confirms become **bottom sheets** (`SHEET_QUERY = max-width 639.98px`) |
| `breakpoint.md` | 768 | below: bottom tab bar + top bar; above: sidebar |
| `breakpoint.lg` | 1024 | multi-column dashboards |
| `breakpoint.xl` / `2xl` | 1280 / 1536 | wide desktop |

Phones (< 640 pt wide in portrait) therefore always reproduce the web's **mobile** layout: bottom nav, sheets instead of dialogs. iPad / Android tablets (≥ 768) should use the sidebar layout (`NavigationSplitView` / `NavigationSuiteScaffold`) — the sidebar tokens already exist.

## 8. `tokens.json` schema

```jsonc
{
  "$meta": {
    "name": "BuddyBudget design tokens", "version": 1,
    "units": { "pt": "1 CSS px = 1 iOS pt = 1 Android dp; 1rem = 16", "em": "multiply by font size" },
    "colorFormat": "#RRGGBB or #RRGGBBAA (sRGB, alpha last)",
    "themes": ["light", "dark"],
    "swatchOrder": ["slate", "blue", …, "emerald-dark"]   // 48 persisted keys, index = position
  },
  "tokens": [ /* flat list, `name` is unique, dot-separated */ ]
}
```

| `type` | Fields | Example |
|---|---|---|
| `color` | `light`, `dark` (hex), `group` (`semantic`, `risk`, `chart`, `categoryGroup`, `swatch`, `sidebar`, `island`, `derived`, `alpha`, `scrim`), `source` (CSS var or expression), optional `note`, swatches also `key` + `index` | `{"name":"color.primary","type":"color","group":"semantic","light":"#15738b","dark":"#219ebc","source":"--primary"}` |
| `dimension` | `value`, `unit` (`pt`) | `{"name":"radius.lg","type":"dimension","value":11,"unit":"pt"}` |
| `number` | `value`, `unit` | `layout.sheetCloseVelocity` |
| `fontFamily` | `value` (family name), `license`, `role` | `font.family.heading` |
| `fontWeight` | `value` (100–900) | `font.weight.medium` = 500 |
| `fontSize` | `size`, `lineHeight` (pt or `null` = inherit) | `font.size.sm` = 14/20 |
| `letterSpacing` | `value`, `unit: "em"` | `font.tracking.wide` = 0.025 |
| `lineHeightMultiplier` | `value` | `font.leading.snug` = 1.375 |
| `typography` | `fontFamily` (reference to a `font.family.*` token), `size`, `lineHeight`, `weight`, `letterSpacingEm`, `tabularNums`, `uppercase`, `note` | `typography.statValue` |
| `shadow` | `layers[]`: `{x, y, blur, spread, color}` | `shadow.md` |
| `border` | `width`, `color` (reference) | `elevation.ring` |
| `spring` | `stiffness`, `damping`, `mass`, `dampingRatio`, `settleMs`, `note` | `motion.spring.soft` |
| `duration` | `value`, `unit: "ms"` | `motion.duration.fast` |
| `cubicBezier` | `value: [x1, y1, x2, y2]` | `motion.easing.expoOut` |

Naming → identifiers: split on `.`, drop the leading category, camel-case the rest; segments starting with a digit are joined to the previous one (`color.chart.1` → `chart1`, `font.size.2xl` → `size2xl`, `space.1_5` → `space1_5`).

Regenerating `tokens.json`: it was produced by a script that parses `:root` and `.dark` in `globals.css` and adds Tailwind defaults / motion constants. When the web palette changes, re-run the extraction and the platform generators in the same PR; a CI check in each app should fail if the generated files differ from what `tokens.json` produces.

## 9. Generator sketch

One script (Node or Python, ~150 lines) in the spec repo, `scripts/gen-tokens.*`, reading `design/tokens.json` and writing:

**iOS** – `BBTokens.generated.swift`
```swift
// GENERATED — do not edit. Source: design/tokens.json
import SwiftUI

extension Color {
    static let bbPrimary = Color(light: 0x15738B, dark: 0x219EBC)
    static let bbPosSoft = Color(light: 0x2F7D57, lightAlpha: 0x1A, dark: 0x7BB79B, darkAlpha: 0x24)
    static let bbChart1  = Color(light: 0x1F5141, dark: 0x7BB79B)
    static func bbSwatch(_ key: String) -> Color { BBSwatch.byKey[key] ?? .bbSwatchSlate }
    // …
}
private extension Color {
    /// Dynamic color resolved per trait collection, so it follows the in-app theme override too.
    init(light: UInt32, lightAlpha: UInt8 = 0xFF, dark: UInt32, darkAlpha: UInt8 = 0xFF) {
        self = Color(UIColor { $0.userInterfaceStyle == .dark
            ? UIColor(hex: dark, alpha: darkAlpha) : UIColor(hex: light, alpha: lightAlpha) })
    }
}
enum BBRadius { static let sm: CGFloat = 6, md: CGFloat = 8, lg: CGFloat = 11, xl: CGFloat = 16 /* … */ }
enum BBSpace  { static let s1: CGFloat = 4, s1_5: CGFloat = 6, s2: CGFloat = 8 /* … */ }
extension Font {
    static let bbStatValue = Font.custom("SpaceGrotesk-Medium", size: 30, relativeTo: .title).monospacedDigit()
    // lineHeight → .lineSpacing(lineHeight - font.lineHeight) applied by a BBText modifier
}
extension Animation {
    static let bbSoft = Animation.interpolatingSpring(mass: 1, stiffness: 260, damping: 28)
    static let bbSnappy = Animation.interpolatingSpring(mass: 0.8, stiffness: 420, damping: 34)
}
```
The in-app theme override (System/Light/Dark) is applied with `.preferredColorScheme(_:)` at the root (and `overrideUserInterfaceStyle` on the window so `UIColor` providers resolve correctly in UIKit-backed views).

**Android** – `BBTokens.kt` (Compose)
```kotlin
// GENERATED — do not edit. Source: design/tokens.json
object BBColorsLight { val primary = Color(0xFF15738B); val posSoft = Color(0x1A2F7D57) /* #RRGGBBAA → 0xAARRGGBB */ }
object BBColorsDark  { val primary = Color(0xFF219EBC); val posSoft = Color(0x247BB79B) }

@Immutable data class BBColors(val background: Color, val foreground: Color, val primary: Color,
    val pos: Color, val neg: Color, val chart1: Color, /* … every color token … */)
val LocalBBColors = staticCompositionLocalOf { lightBBColors }

// Map the shadcn roles onto Material 3 so stock components look right:
fun bbColorScheme(c: BBColors, dark: Boolean) = (if (dark) darkColorScheme() else lightColorScheme()).copy(
    primary = c.primary, onPrimary = c.primaryForeground, background = c.background, onBackground = c.foreground,
    surface = c.card, onSurface = c.cardForeground, surfaceVariant = c.muted, onSurfaceVariant = c.mutedForeground,
    secondaryContainer = c.secondary, onSecondaryContainer = c.secondaryForeground, error = c.destructive,
    outline = c.border, outlineVariant = c.input, surfaceContainerHigh = c.popover)

val BBShapes = Shapes(extraSmall = RoundedCornerShape(6.dp), small = RoundedCornerShape(8.dp),
    medium = RoundedCornerShape(11.dp), large = RoundedCornerShape(16.dp), extraLarge = RoundedCornerShape(24.dp))

object BBType {
    val statValue = TextStyle(fontFamily = SpaceGrotesk, fontWeight = FontWeight.W500, fontSize = 30.sp,
        lineHeight = 36.sp, fontFeatureSettings = "tnum",
        lineHeightStyle = LineHeightStyle(LineHeightStyle.Alignment.Center, LineHeightStyle.Trim.None))
}
object BBMotion { val soft = spring<Float>(dampingRatio = 0.8682f, stiffness = 260f)
                  val snappy = spring<Float>(dampingRatio = 0.9274f, stiffness = 525f) }
```
Custom (non-Material) tokens — `pos`, `neg`, `text2/3`, chart, risk, group, swatch, island — live only in `LocalBBColors` / `Color.bb*`; components must read from those, never from `MaterialTheme.colorScheme` for financial semantics.

Line-height parity: CSS centers glyphs in the line box ("half-leading"). Compose needs `LineHeightStyle(Alignment.Center, Trim.None)` and `includeFontPadding = false`; SwiftUI needs a `BBText` modifier that sets `lineSpacing(lineHeight − uiFont.lineHeight)` plus top/bottom padding of half the difference.

## 10. Risks and open points

1. **Font parity**: three custom families must be bundled (~300–600 KB). Variable-font weight interpolation and hinting differ between CoreText, Skia (Android) and browsers; use static weight instances and validate with screenshot tests. OFL allows bundling; include the license.
2. **Line-height/vertical metrics**: CSS half-leading vs. platform defaults (`includeFontPadding`, SwiftUI line spacing) cause 1–3 pt vertical drift in dense rows unless handled as in §9.
3. **Alpha compositing**: `#RRGGBBAA` vs Android `0xAARRGGBB` byte order — a generator bug here silently produces wrong tints; add a unit test for `posSoft`.
4. **Color-mix in oklch/oklab**: only two pre-mixed colors exist; any *new* web `color-mix()` must be added to the generator, not approximated by sRGB alpha blending (results differ by a few hex units). No oklch→sRGB gamut clipping occurred for the current palette (all results in gamut).
5. **Dense desktop metrics** (32 pt buttons/inputs) are below mobile touch-target guidelines: keep visual sizes, expand hit areas. Inputs must use 16 pt text on iOS (web does the same to avoid zoom; native has no zoom but keep it for parity with mobile web).
6. **Shadows** do not map 1:1 to Compose elevation (tonal, light-source based) — use `dropShadow`, or accept small differences; cards rely on the 10% ring, which is exact.
7. **Dark theme override**: Material components and UIKit-backed SwiftUI views read the system theme unless the in-app override is propagated (§9).
8. **Swatch keys are persisted** server-side: never rename or reorder `swatchOrder`; it would recolor every user's categories.
