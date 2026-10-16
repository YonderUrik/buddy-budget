# Brand identity + installable PWA — design

Date: 2026-09-25

## Context and goal

The designer delivered BuddyBudget's final logo package (`Archive.zip`, received and unpacked in this session): full wordmark, logomark (the "B" made of three overlapping light-blue/navy/yellow shapes), light/dark/monochrome variants, vector sources (SVG/EPS/AI/PDF) and pre-rendered app icons for iOS/Android in all standard sizes.

Goal: integrate this brand into the app (replacing the current forest-green/cream palette, extracted back then from the Claude Design mockup and never meant as the final brand) and make the app installable as a PWA on desktop, iOS and Android, so that the icon/name shown on the home screen and in the app switcher reflect the new brand.

## Out of scope (decided in brainstorming)

- Native apps published on the App Store / Play Store (no Capacitor/Expo wrapper). Only a PWA installable via the browser.
- Service worker / offline operation. The PWA is installable (manifest + icons) but doesn't cache resources for offline use — the app remains a client that needs the network, as today.
- i18n of the brand (the name "BuddyBudget" stays the same in every language when i18n is implemented).

## 1. Color palette — full brand

Complete replacement of the color tokens in `app/globals.css` (both `:root` and `.dark`), taken from the exact values in the logo's source SVG files (`#0f0f3f` navy, `#219ebc` light blue, `#ffb703` yellow).

| Token | Light | Dark | Notes |
|---|---|---|---|
| `--background` | `#F6F8FA` | `#0F0F3F` | Light: cool neutral blue-grey (not pure white, to let cards breathe). Dark: the logo's navy. |
| `--foreground` | `#0F0F3F` | `#ECEDF7` | |
| `--card` | `#FFFFFF` | `#171A4D` | |
| `--card-foreground` | `#0F0F3F` | `#ECEDF7` | |
| `--primary` | `#187E98` | `#219EBC` | Light: brand blue darkened for AA contrast on white (pure `#219EBC` is ~3.4:1 on white, insufficient for text; `#187E98` is ~4.6:1). Dark: pure brand blue (on dark navy the contrast is already sufficient). |
| `--primary-foreground` | `#FFFFFF` | `#0F0F3F` | |
| `--accent` | `rgba(255,183,3,0.14)` | `rgba(255,183,3,0.18)` | Brand yellow as a soft accent (badges, highlights), not as a solid surface. |
| `--accent-foreground` | `#8A5A00` | `#FFB703` | Light: darkened yellow for text-on-soft legibility; dark: pure yellow. |
| `--ring` | `#187E98` | `#219EBC` | Aligned with `--primary`. |
| `--pos` / `--pos-soft` | unchanged | unchanged | Income green — stays semantic, non-brand. |
| `--neg` / `--neg-soft` | unchanged | unchanged | Expense red — stays semantic, non-brand. |
| `--sidebar` | `#0F0F3F` | `#0B0B2E` | **Behavioral change**: the sidebar becomes fixed navy in both themes (today it is light in the light theme), because the logomark is designed to sit on a navy/dark background in all the variants provided. |
| `--sidebar-foreground` | `#ECEDF7` | `#ECEDF7` | |
| `--sidebar-primary` | `#219EBC` | `#219EBC` | Color of the active item/active icon. |
| `--sidebar-primary-foreground` | `#0F0F3F` | `#0F0F3F` | |
| `--sidebar-accent` | `rgba(255,255,255,0.08)` | `rgba(255,255,255,0.06)` | Hover/active on the navy surface. |
| `--sidebar-accent-foreground` | `#FFFFFF` | `#FFFFFF` | |
| `--sidebar-border` | `rgba(255,255,255,0.10)` | `rgba(255,255,255,0.08)` | |
| `--sidebar-ring` | `#219EBC` | `#219EBC` | |

All other existing tokens (`--muted`, `--destructive`, `--border`, `--input`, `--text-2`, `--text-3`, etc.) remain conceptually the same but are re-tinted in navy/blue-grey tones instead of green/cream, for consistency (same light/dark scheme as now, new tint). No new token introduced: it is a replacement of values, not of structure.

Fonts unchanged: `font-heading` (Space Grotesk), `font-sans` (Hanken Grotesk) — the logo doesn't introduce a proprietary font (it is drawn, not typographic in a way that would require a specific font).

## 2. Logo assets

Sources in the zip (in `Archive.zip`, repo root — to be moved/removed after extraction) copied into `public/brand/` (only the formats used at runtime; EPS/AI/PDF source files stay out of the public repo, archived elsewhere or discarded — the code doesn't need them):

- `public/brand/logo-full-navy.svg` — full wordmark, navy text (from `buddy budget-01.svg`) → for light backgrounds.
- `public/brand/logo-full-white.svg` — full wordmark, white text (from `buddy budget-03.svg`) → for navy/dark backgrounds.
- `public/brand/logo-mark.svg` — logomark "B" only (from `buddy budget-02.svg`) → standalone icon, sidebar, favicon source.

The pre-rendered app icons (`App Icon/iOS/*.png`, `App Icon/Android/*.png` in the zip) are copied into `public/icons/` with normalized names:
- `public/icons/icon-192.png`, `icon-512.png` (from `android_192.png`, `android_512.png`) → PWA manifest, including `maskable` variants.
- `public/icons/apple-touch-icon.png` (from `ios_180.png`) → iOS home screen.
- The other sizes (36/48/72/96/144 Android, 20-167 iOS) are not strictly needed by modern browsers (which scale from 512), but are still copied into `public/icons/` for completeness/future use without being referenced explicitly, except the two above.

## 3. Where the logo appears

| Place | What | How |
|---|---|---|
| Expanded sidebar (desktop) | logomark + "BuddyBudget" wordmark | `logo-mark.svg` (24px) + text, replaces the current single font-heading letter "B" in `AppSidebar` |
| Collapsed sidebar (desktop/tablet) | logomark only | replaces the current font-heading `<span>B</span>` |
| Mobile topbar | logomark only (+ text name as today, unchanged) | `MobileTopbar`: logomark next to the `brandName` text |
| Login — `LoginStory` panel | logomark as header/watermark | small, above the title "I tuoi movimenti, finalmente leggibili." ("Your transactions, finally readable.") |
| Favicon | logomark | `app/icon.svg` (Next.js file convention — replaces `app/favicon.ico`) |
| PWA home screen / app switcher | pre-rendered PNG icons | via manifest, see below |

All uses in sidebar/topbar/login use `logo-mark.svg` (single variant) because it is designed on a navy background — consistent with the sidebar always being navy after point 1. No new React component: direct `<Image>`/`<img>` where needed, since they are static assets with no logic.

## 4. PWA — installability

- `app/manifest.ts` (Next.js file convention, replaces the current absence of a manifest):
  - `name: "BuddyBudget"`, `short_name: "BuddyBudget"`
  - `description`: short, in Italian (e.g. "Gestione finanziaria personale" — "Personal finance management")
  - `start_url: "/"` (already redirects to `/panoramica` for authenticated users)
  - `display: "standalone"`
  - `background_color: "#0F0F3F"`, `theme_color: "#0F0F3F"` (consistent with dark `--sidebar`/`--background`)
  - `icons`: `icon-192.png`/`icon-512.png`, each with one `purpose: "any"` entry and one `purpose: "maskable"` entry (the same file is fine: the logomark already has enough internal margin, visually checked on the square renders provided)
- `app/layout.tsx` (Next.js `<head>`/metadata):
  - `apple-touch-icon` → `public/icons/apple-touch-icon.png`
  - `<meta name="apple-mobile-web-app-capable" content="yes">` and `apple-mobile-web-app-status-bar-style` consistent with the theme
  - `viewport` with `viewportFit: "cover"` (Next.js `generateViewport`/`viewport` export) to handle safe areas on iPhones with a notch — CSS `env(safe-area-inset-*)` is already usable if needed, but no component explicitly requires it today; only the enabling meta is added
  - Next.js `themeColor` export aligned to `#0F0F3F` (or to the active background/sidebar token)

No change to `next.config.ts` is needed for the static manifest alone (Next.js serves `app/manifest.ts` automatically at `/manifest.webmanifest`).

## 5. Verification

- Clean `pnpm build`/`tsc --noEmit`.
- AA contrast verified by calculation (WCAG) on the foreground/background pairs that change: `--primary` on light `--background`, `--sidebar-foreground` on `--sidebar`, `--accent-foreground` on `--accent`.
- Manual verification by the user (required, no real browser in the agent sandbox): light/dark appearance of all main screens with the new palette; "Aggiungi a Home" ("Add to Home Screen") on iOS Safari and Android Chrome shows the correct icon/name; PWA installation on desktop Chrome/Edge; the login panel (`LoginStory`, heavily animated/colorful) stays readable with the new palette — it is the component most at risk of visually clashing with the new background/accents.

## 6. Implementation sequence (for the plan)

1. Extract the assets from the zip into `public/brand/` and `public/icons/`, remove `Archive.zip` from the root.
2. Rewrite the color tokens in `app/globals.css` (point 1).
3. Replace the logomark in the sidebar (expanded/collapsed) and the mobile topbar.
4. Add the logomark to `LoginStory`.
5. Replace the favicon (`app/icon.svg`) and remove `app/favicon.ico` if orphaned.
6. Create `app/manifest.ts` + PWA meta in `app/layout.tsx`.
7. Build/tsc/contrast check, visual pass over all main screens (light/dark) before handing over for the user's manual verification.

No DB migration, no change to API routes or domain logic: work entirely in `app/`, `components/layout/`, `components/domain/auth/`, `public/`.
