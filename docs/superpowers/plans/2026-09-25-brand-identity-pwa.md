# Brand identity + installable PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the BuddyBudget brand (the designer's logo, navy/light blue/yellow palette) across the whole app and make it installable as a PWA on desktop/iOS/Android.

**Architecture:** Replacement of the values of the existing CSS design tokens in `app/globals.css` (no new tokens, no new architecture), replacement of the logo/icon assets wherever a placeholder appears today (lucide `Wallet`, text letter "B"), addition of `app/manifest.ts` (Next.js file convention) and PWA metadata in `app/layout.tsx`. No changes to DB, API or domain logic.

**Tech Stack:** Next.js 16 App Router (file convention `app/manifest.ts`, `app/icon.svg`), Tailwind CSS v4 (`@theme inline` already in place), static SVG/PNG assets in `public/`.

**Spec:** `docs/superpowers/specs/2026-09-25-brand-identity-pwa-design.md`

## Global Constraints

- No hardcoded hex colors or radii in components: only token classes/`var(--token)` (CLAUDE.md rule already in force) — the new hex values live **only** in `app/globals.css`.
- `--pos`/`--pos-soft`/`--neg`/`--neg-soft` stay unchanged (semantic, not brand).
- No service worker, no offline cache, no native store wrapper — only manifest + icons.
- Fonts unchanged (Space Grotesk / Hanken Grotesk).
- Minimal JSDoc on every touched component, consistent with the existing style in the file.
- Text/background contrast at least AA (4.5:1 for normal text) on every foreground/background pair introduced or changed.
- The `Archive.zip` file in the repo root (the designer's delivery, untracked in git) must be deleted at the end of Task 1 once the needed assets are extracted — it must not be committed.

## Review Focus

- **Text-on-surface contrast**: `--sidebar-foreground` on navy `--sidebar`, `--primary-foreground` on light blue `--primary`, `--accent-foreground` on soft-yellow `--accent`, in both themes — a color chosen "by eye" can drop below AA and make menus/buttons unreadable.
- **Missing or broken PWA icon**: if a path in `manifest.ts` does not match a file actually copied into `public/icons/`, PWA installation fails silently (no visible error in the UI, only the "Add to Home Screen" prompt missing) — check that every referenced path exists on disk before committing.
- **Navy sidebar in the light theme too**: this is an explicit behavior change (before, the sidebar was light in the light theme) — an element that assumed a light sidebar (e.g. `border-sidebar-border` meant to be subtle on a light background) could end up invisible or too faint on navy; visually check the hover/active/focus states of every nav item in both themes.
- **`LoginStory`/`AuthLayout` component**: uses `primary-foreground` for almost all the text of the left panel, assuming that `--primary` stays a dark/saturated enough background to host near-pure-white text — with `--primary` now light blue (`#187E98`/`#219EBC`, lighter than the previous forest green) check that `--primary-foreground` stays readable (pure white `#FFFFFF` chosen on purpose in the spec for this).
- **Multi-format favicon**: `app/icon.svg` coexists with the pre-existing `app/favicon.ico` — if a browser requests `favicon.ico` and Next no longer serves it because the `icon.svg` convention silently replaces it, check that both stay reachable (no removal of the `.ico` file in this plan, so as not to break legacy clients).

---

## File map

**New:**
- `public/brand/logo-full-navy.svg`, `public/brand/logo-full-white.svg`, `public/brand/logo-mark.svg` — static logo assets
- `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/apple-touch-icon.png` — PWA icons
- `app/icon.svg` — Next.js favicon (Next serves it automatically at `/icon.svg`, route convention)
- `app/manifest.ts` — PWA manifest (Next.js file convention, served at `/manifest.webmanifest`)

**Modified:**
- `app/globals.css` — `:root`/`.dark` color tokens
- `components/layout/sidebar.tsx` — logomark instead of the text letter "B" (lines 249-261)
- `components/layout/mobile-topbar.tsx` — logomark next to the brand text
- `app/(auth)/layout.tsx` — logomark instead of the `Wallet` icon (lines 1, 11-16, 40-43)
- `app/layout.tsx` — `viewport`/`themeColor` export, `apple-touch-icon` link

**Removed:** none (existing assets like `app/favicon.ico` stay, as per the Review Focus above).

---

### Task 1: Logo asset extraction

**Files:**
- Create: `public/brand/logo-full-navy.svg`, `public/brand/logo-full-white.svg`, `public/brand/logo-mark.svg`
- Create: `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/apple-touch-icon.png`
- Delete: `Archive.zip` (repo root, untracked)

**Interfaces:**
- Consumes: none (first task).
- Produces: the 6 files above, referenced by exact path by all following tasks.

- [ ] **Step 1: Extract the zip into a temporary folder**

```bash
mkdir -p /tmp/bb-logos
unzip -o Archive.zip -d /tmp/bb-logos
find /tmp/bb-logos -type f | grep -v __MACOSX
```

Check that the output includes (among others):
- `Logo/Source/SVG/buddy budget-01.svg` (navy wordmark)
- `Logo/Source/SVG/buddy budget-02.svg` ("B" logomark, 378×464 viewBox)
- `Logo/Source/SVG/buddy budget-03.svg` (white wordmark on navy)
- `App Icon/Android/android_192.png`, `android_512.png`
- `App Icon/iOS/ios_180.png`

- [ ] **Step 2: Copy and rename the SVG assets**

```bash
mkdir -p public/brand public/icons
cp "/tmp/bb-logos/Logo/Source/SVG/buddy budget-01.svg" public/brand/logo-full-navy.svg
cp "/tmp/bb-logos/Logo/Source/SVG/buddy budget-03.svg" public/brand/logo-full-white.svg
cp "/tmp/bb-logos/Logo/Source/SVG/buddy budget-02.svg" public/brand/logo-mark.svg
```

- [ ] **Step 3: Copy the PNG icons**

```bash
cp "/tmp/bb-logos/App Icon/Android/android_192.png" public/icons/icon-192.png
cp "/tmp/bb-logos/App Icon/Android/android_512.png" public/icons/icon-512.png
cp "/tmp/bb-logos/App Icon/iOS/ios_180.png" public/icons/apple-touch-icon.png
```

- [ ] **Step 4: Check the copied files**

```bash
ls -la public/brand public/icons
file public/icons/icon-512.png
```

Expected: `icon-512.png` reports 512x512 dimensions (or close — the output of `file` on a PNG shows "PNG image data, 512 x 512" or similar); all 6 files exist and have size > 0.

- [ ] **Step 5: Remove the zip and the temporary folder**

```bash
rm -f Archive.zip
rm -rf /tmp/bb-logos
```

- [ ] **Step 6: Commit**

```bash
git add public/brand public/icons
git commit -m "chore(brand): aggiungi asset logo e icone PWA dal pacchetto designer

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

Note: `Archive.zip` was untracked, removing it from disk produces nothing to commit for that file.

---

### Task 2: Brand color tokens in `globals.css`

**Files:**
- Modify: `app/globals.css:62-155` (`:root` block)
- Modify: `app/globals.css:157-249` (`.dark` block)

**Interfaces:**
- Consumes: none.
- Produces: new values for `--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--border`, `--input`, `--ring`, `--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-primary-foreground`, `--sidebar-accent`, `--sidebar-accent-foreground`, `--sidebar-border`, `--sidebar-ring` — token names unchanged, only the hex/rgba values change. Every component that already consumes these tokens (the whole app, being on Tailwind `@theme inline`) inherits them without changes to its own code.

- [ ] **Step 1: Replace the `:root` block (lines 62-155)**

Replace the whole `:root { ... }` block with:

```css
:root {
  /* BuddyBudget brand design tokens (light palette) — see docs/superpowers/specs/2026-09-25-brand-identity-pwa-design.md */
  --background: #f6f8fa;
  --foreground: #0f0f3f;
  --text-2: #4a4d73;
  --text-3: #8083a3;
  --card: #ffffff;
  --card-foreground: #0f0f3f;
  --popover: #ffffff;
  --popover-foreground: #0f0f3f;
  --primary: #187e98;
  --primary-foreground: #ffffff;
  --secondary: #e9edf2;
  --secondary-foreground: #0f0f3f;
  --muted: #e9edf2;
  --muted-foreground: #4a4d73;
  --accent: rgba(255, 183, 3, 0.14);
  --accent-foreground: #8a5a00;
  --destructive: #b0473b;
  --border: #dde2e9;
  --input: #dde2e9;
  --ring: #187e98;
  --pos: #2f7d57;
  --pos-soft: rgba(47, 125, 87, 0.1);
  --neg: #b0473b;
  --neg-soft: rgba(176, 71, 59, 0.09);
  --chart-1: #1f5141;
  --chart-2: #2f7d57;
  --chart-3: #41705f;
  --chart-4: #739688;
  --chart-5: #b6c4bc;
  --group-dovuta: #dc2626;
  --group-voluta: #d97706;
  --group-futuro: #16a34a;
  --group-saltuaria: #2563eb;
  --group-uncategorized: #94a3b8;
  --swatch-slate: #94a3b8;
  --swatch-blue: #3b82f6;
  --swatch-green: #22c55e;
  --swatch-yellow: #facc15;
  --swatch-purple: #a855f6;
  --swatch-orange: #f97316;
  --swatch-red: #ef4444;
  --swatch-teal: #14b8a6;
  --swatch-pink: #ec4899;
  --swatch-indigo: #6366f1;
  --swatch-cyan: #06b6d4;
  --swatch-lime: #84cc16;
  --swatch-amber: #f59e0b;
  --swatch-rose: #f43f5e;
  --swatch-violet: #8b5cf6;
  --swatch-emerald: #10b981;
  --swatch-slate-light: #cbd5e1;
  --swatch-blue-light: #93c5fd;
  --swatch-green-light: #86efac;
  --swatch-yellow-light: #fde047;
  --swatch-purple-light: #d8b4fe;
  --swatch-orange-light: #fdba74;
  --swatch-red-light: #fca5a5;
  --swatch-teal-light: #5eead4;
  --swatch-pink-light: #f9a8d4;
  --swatch-indigo-light: #a5b4fc;
  --swatch-cyan-light: #67e8f9;
  --swatch-lime-light: #bef264;
  --swatch-amber-light: #fcd34d;
  --swatch-rose-light: #fda4af;
  --swatch-violet-light: #c4b5fd;
  --swatch-emerald-light: #6ee7b7;
  --swatch-slate-dark: #334155;
  --swatch-blue-dark: #1d4ed8;
  --swatch-green-dark: #15803d;
  --swatch-yellow-dark: #a16207;
  --swatch-purple-dark: #7e22ce;
  --swatch-orange-dark: #c2410c;
  --swatch-red-dark: #b91c1c;
  --swatch-teal-dark: #0f766e;
  --swatch-pink-dark: #be185d;
  --swatch-indigo-dark: #4338ca;
  --swatch-cyan-dark: #0e7490;
  --swatch-lime-dark: #4d7c0f;
  --swatch-amber-dark: #b45309;
  --swatch-rose-dark: #be123c;
  --swatch-violet-dark: #6d28d9;
  --swatch-emerald-dark: #047857;
  --radius: 11px;
  --sidebar: #0f0f3f;
  --sidebar-foreground: #ecedf7;
  --sidebar-primary: #219ebc;
  --sidebar-primary-foreground: #0f0f3f;
  --sidebar-accent: rgba(255, 255, 255, 0.08);
  --sidebar-accent-foreground: #ffffff;
  --sidebar-border: rgba(255, 255, 255, 0.1);
  --sidebar-ring: #219ebc;
}
```

Note: `--text-2`/`--text-3` were not in the original spec with explicit values — here they are derived with the same logic as the previous set (secondary/tertiary text, same hue as `--foreground`, lightened), to stay consistent with the rest of the navy palette without introducing a foreign hue. `--chart-*`, `--group-*`, `--swatch-*` stay unchanged (out of scope: `--chart-*` is not referenced by any component, `--group-*`/`--swatch-*` are semantic/functional palettes independent of the brand, already treated as such in the project's earlier decisions).

- [ ] **Step 2: Replace the `.dark` block (lines 157-249)**

Replace the whole `.dark { ... }` block with:

```css
.dark {
  /* BuddyBudget brand design tokens (dark palette) — see docs/superpowers/specs/2026-09-25-brand-identity-pwa-design.md */
  --background: #0f0f3f;
  --foreground: #ecedf7;
  --text-2: #a3a6c9;
  --text-3: #6f739c;
  --card: #171a4d;
  --card-foreground: #ecedf7;
  --popover: #1d2159;
  --popover-foreground: #ecedf7;
  --primary: #219ebc;
  --primary-foreground: #0f0f3f;
  --secondary: #1d2159;
  --secondary-foreground: #ecedf7;
  --muted: #1d2159;
  --muted-foreground: #a3a6c9;
  --accent: rgba(255, 183, 3, 0.18);
  --accent-foreground: #ffb703;
  --destructive: #d2887b;
  --border: #2a2e66;
  --input: #2a2e66;
  --ring: #219ebc;
  --pos: #7bb79b;
  --pos-soft: rgba(123, 183, 155, 0.14);
  --neg: #d2887b;
  --neg-soft: rgba(210, 136, 123, 0.14);
  --chart-1: #7bb79b;
  --chart-2: #5fb98a;
  --chart-3: #5b9280;
  --chart-4: #427060;
  --chart-5: #2f4940;
  --group-dovuta: #f87171;
  --group-voluta: #facc15;
  --group-futuro: #4ade80;
  --group-saltuaria: #60a5fa;
  --group-uncategorized: #64748b;
  --swatch-slate: #94a3b8;
  --swatch-blue: #3b82f6;
  --swatch-green: #22c55e;
  --swatch-yellow: #facc15;
  --swatch-purple: #a855f6;
  --swatch-orange: #f97316;
  --swatch-red: #ef4444;
  --swatch-teal: #14b8a6;
  --swatch-pink: #ec4899;
  --swatch-indigo: #6366f1;
  --swatch-cyan: #06b6d4;
  --swatch-lime: #84cc16;
  --swatch-amber: #f59e0b;
  --swatch-rose: #f43f5e;
  --swatch-violet: #8b5cf6;
  --swatch-emerald: #10b981;
  --swatch-slate-light: #cbd5e1;
  --swatch-blue-light: #93c5fd;
  --swatch-green-light: #86efac;
  --swatch-yellow-light: #fde047;
  --swatch-purple-light: #d8b4fe;
  --swatch-orange-light: #fdba74;
  --swatch-red-light: #fca5a5;
  --swatch-teal-light: #5eead4;
  --swatch-pink-light: #f9a8d4;
  --swatch-indigo-light: #a5b4fc;
  --swatch-cyan-light: #67e8f9;
  --swatch-lime-light: #bef264;
  --swatch-amber-light: #fcd34d;
  --swatch-rose-light: #fda4af;
  --swatch-violet-light: #c4b5fd;
  --swatch-emerald-light: #6ee7b7;
  --swatch-slate-dark: #334155;
  --swatch-blue-dark: #1d4ed8;
  --swatch-green-dark: #15803d;
  --swatch-yellow-dark: #a16207;
  --swatch-purple-dark: #7e22ce;
  --swatch-orange-dark: #c2410c;
  --swatch-red-dark: #b91c1c;
  --swatch-teal-dark: #0f766e;
  --swatch-pink-dark: #be185d;
  --swatch-indigo-dark: #4338ca;
  --swatch-cyan-dark: #0e7490;
  --swatch-lime-dark: #4d7c0f;
  --swatch-amber-dark: #b45309;
  --swatch-rose-dark: #be123c;
  --swatch-violet-dark: #6d28d9;
  --swatch-emerald-dark: #047857;
  --sidebar: #0b0b2e;
  --sidebar-foreground: #ecedf7;
  --sidebar-primary: #219ebc;
  --sidebar-primary-foreground: #0f0f3f;
  --sidebar-accent: rgba(255, 255, 255, 0.06);
  --sidebar-accent-foreground: #ffffff;
  --sidebar-border: rgba(255, 255, 255, 0.08);
  --sidebar-ring: #219ebc;
}
```

- [ ] **Step 3: Check the contrast of the key pairs (manual calculation, no graphical tool available)**

Compute the WCAG contrast ratio (relative luminance) for:
- `--primary-foreground` (`#ffffff`) on light `--primary` (`#187e98`) → expected ≥ 4.5:1
- `--sidebar-foreground` (`#ecedf7`) on `--sidebar` (`#0f0f3f`) → expected ≥ 4.5:1 (practically white on near-black navy, well above the threshold)
- light `--accent-foreground` (`#8a5a00`) on light `--background` (`#f6f8fa`), assuming the text appears on a badge with an `--accent` background composited on `--background` → expected ≥ 4.5:1
- `--foreground` (`#0f0f3f`) on light `--background` (`#f6f8fa`) → expected ≥ 4.5:1 (near-black on near-white, wide margin)

If a value is below the threshold, darken/lighten that specific color (without changing the hue) until it passes, then repeat Step 1 or 2 with the corrected value.

- [ ] **Step 4: Check that the project compiles**

```bash
pnpm tsc --noEmit
```

Expected: no errors (this task touches no TypeScript code, only CSS — the command checks there are no accidental regressions).

- [ ] **Step 5: Commit**

```bash
git add app/globals.css
git commit -m "feat(brand): sostituisci palette colori con brand navy/azzurro/giallo

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Logomark in the sidebar and mobile topbar

**Files:**
- Modify: `components/layout/sidebar.tsx:249-261`
- Modify: `components/layout/mobile-topbar.tsx:59-62`

**Interfaces:**
- Consumes: `public/brand/logo-mark.svg` (Task 1).
- Produces: no new public interface — visual replacement internal to the two components, no new props.

- [ ] **Step 1: Replace the text monogram in `AppSidebar` (lines 249-261)**

In `components/layout/sidebar.tsx`, replace:

```tsx
        {isCollapsed ? (
          /* Monogram when collapsed */
          <span
            className="font-heading text-lg font-bold text-sidebar-primary"
            aria-label="BuddyBudget"
          >
            B
          </span>
        ) : (
          <span className="font-heading text-base font-bold text-sidebar-foreground truncate">
            BuddyBudget
          </span>
        )}
```

with:

```tsx
        {isCollapsed ? (
          <Image
            src="/brand/logo-mark.svg"
            alt="BuddyBudget"
            width={28}
            height={34}
            className="h-8 w-auto"
          />
        ) : (
          <span className="flex items-center gap-2 min-w-0">
            <Image
              src="/brand/logo-mark.svg"
              alt=""
              width={24}
              height={29}
              className="h-6 w-auto shrink-0"
              aria-hidden="true"
            />
            <span className="font-heading text-base font-bold text-sidebar-foreground truncate">
              BuddyBudget
            </span>
          </span>
        )}
```

`Image` from `next/image` is already imported at the top of the file (line 23). The `width`/`height` dimensions reflect the real aspect ratio of the logomark (viewBox `378.1462 463.8719` ≈ 0.815:1).

- [ ] **Step 2: Replace the brand text in `MobileTopbar` (lines 59-62)**

In `components/layout/mobile-topbar.tsx`, replace:

```tsx
      {/* Brand */}
      <span className="font-heading text-base font-bold text-sidebar-foreground">
        {brandName}
      </span>
```

with:

```tsx
      {/* Brand */}
      <span className="flex items-center gap-2 font-heading text-base font-bold text-sidebar-foreground">
        <Image
          src="/brand/logo-mark.svg"
          alt=""
          width={22}
          height={27}
          className="h-6 w-auto"
          aria-hidden="true"
        />
        {brandName}
      </span>
```

and add the import at the top of the file (after line 18 `import { Menu } from "lucide-react";`):

```tsx
import Image from "next/image";
```

- [ ] **Step 3: Check that the project compiles**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Start the dev server and check visually**

```bash
pnpm dev
```

Open `/panoramica` (requires login — if not available in this environment, at least check that there are no console/build errors; the full visual check remains part of the user's final manual verification). Check: expanded sidebar shows logomark + "BuddyBudget", collapsed sidebar shows only the logomark, readable on the navy background, mobile topbar (`<768px`) shows logomark + text.

- [ ] **Step 5: Commit**

```bash
git add components/layout/sidebar.tsx components/layout/mobile-topbar.tsx
git commit -m "feat(brand): logomark in sidebar e topbar mobile

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Logomark in the login panel

**Files:**
- Modify: `app/(auth)/layout.tsx:1, 11-16, 40-43`

**Interfaces:**
- Consumes: `public/brand/logo-mark.svg` (Task 1).
- Produces: none — internal visual replacement.

- [ ] **Step 1: Remove the `Wallet` import and add the `Image` one**

In `app/(auth)/layout.tsx`, replace line 1:

```tsx
import { Wallet } from "lucide-react";
```

with:

```tsx
import Image from "next/image";
```

- [ ] **Step 2: Replace the icon badge in the desktop panel (lines 11-16)**

Replace:

```tsx
        <div className="flex items-center gap-2.5 font-heading text-xl font-bold">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary-foreground text-primary">
            <Wallet className="size-5" aria-hidden="true" />
          </span>
          {BRAND_NAME}
        </div>
```

with:

```tsx
        <div className="flex items-center gap-2.5 font-heading text-xl font-bold">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary-foreground p-1.5">
            <Image src="/brand/logo-mark.svg" alt="" width={24} height={29} className="h-full w-auto" aria-hidden="true" />
          </span>
          {BRAND_NAME}
        </div>
```

(the white square `bg-primary-foreground` badge stays as a frame, the colored logomark replaces the monochrome `Wallet` icon inside it — consistent with the fact that the logomark has its own colors and does not use `currentColor`.)

- [ ] **Step 3: Replace the mobile header (lines 40-43, original numbering — after Step 2 they are shifted by a few lines, search by content)**

Replace:

```tsx
        <div className="flex items-center gap-2 p-6 font-heading text-lg font-bold text-primary lg:hidden">
          <Wallet className="size-5" aria-hidden="true" />
          {BRAND_NAME}
        </div>
```

with:

```tsx
        <div className="flex items-center gap-2 p-6 font-heading text-lg font-bold text-primary lg:hidden">
          <Image src="/brand/logo-mark.svg" alt="" width={20} height={24} className="h-5 w-auto" aria-hidden="true" />
          {BRAND_NAME}
        </div>
```

- [ ] **Step 4: Check that the project compiles**

```bash
pnpm tsc --noEmit
```

Expected: no errors, no unused imports (`Wallet` no longer referenced in the file).

- [ ] **Step 5: Commit**

```bash
git add "app/(auth)/layout.tsx"
git commit -m "feat(brand): logomark nel pannello di login

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Favicon SVG

**Files:**
- Create: `app/icon.svg`

**Interfaces:**
- Consumes: `public/brand/logo-mark.svg` (Task 1).
- Produces: favicon served automatically by Next.js at `/icon.svg` and referenced in the `<link>` tags generated in the head.

- [ ] **Step 1: Copy the logomark as the favicon**

```bash
cp public/brand/logo-mark.svg app/icon.svg
```

Next.js recognises `app/icon.svg` as a file convention and automatically generates the corresponding `<link rel="icon">` tag, in addition to the pre-existing `app/favicon.ico` (which stays unchanged, see Review Focus). No code change needed in `app/layout.tsx` for this step.

- [ ] **Step 2: Check that the project compiles**

```bash
pnpm tsc --noEmit
pnpm build
```

Expected: clean build, no errors. The build log lists `/icon.svg` among the generated routes.

- [ ] **Step 3: Commit**

```bash
git add app/icon.svg
git commit -m "feat(brand): favicon SVG dal logomark

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: PWA manifest and metadata

**Files:**
- Create: `app/manifest.ts`
- Modify: `app/layout.tsx:1-26`

**Interfaces:**
- Consumes: `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/apple-touch-icon.png` (Task 1).
- Produces: `/manifest.webmanifest` served automatically by Next.js; `themeColor`/`viewport` exported from `app/layout.tsx` following the Next.js `generateViewport`/`viewport` convention.

- [ ] **Step 1: Write `app/manifest.ts`**

```ts
import type { MetadataRoute } from "next";

/**
 * BuddyBudget PWA manifest: makes the app installable on desktop, iOS and Android
 * ("Aggiungi a Home"/"Installa app"). No service worker: the app stays a client
 * that requires the network, it does not work offline.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BuddyBudget",
    short_name: "BuddyBudget",
    description: "Gestione finanziaria personale — patrimonio, spese, investimenti.",
    start_url: "/",
    display: "standalone",
    background_color: "#0f0f3f",
    theme_color: "#0f0f3f",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
```

- [ ] **Step 2: Add `viewport` and `apple-touch-icon` to `app/layout.tsx`**

In `app/layout.tsx`, after the import `import type { Metadata } from "next";` (line 1), add:

```tsx
import type { Metadata, Viewport } from "next";
```

(replaces the existing line 1, adding `Viewport` to the import).

After the `export const metadata: Metadata = { ... };` block (lines 23-26), add:

```tsx
export const viewport: Viewport = {
  themeColor: "#0f0f3f",
  viewportFit: "cover",
};
```

And update `metadata` to include the Apple touch icon (replace the block at lines 23-26):

```tsx
export const metadata: Metadata = {
  title: "BuddyBudget",
  description: "Gestione finanziaria personale — patrimonio, spese, investimenti.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BuddyBudget",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};
```

`appleWebApp` is the typed field of Next.js `Metadata` that generates `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style` and `apple-mobile-web-app-title`; no need to write the `<meta>` tags by hand.

- [ ] **Step 3: Check that the project compiles**

```bash
pnpm tsc --noEmit
pnpm build
```

Expected: clean build. The build log lists `/manifest.webmanifest` among the generated routes.

- [ ] **Step 4: Manually check the served manifest**

```bash
pnpm dev
curl -s http://localhost:3000/manifest.webmanifest
```

Expected: valid JSON with `"name":"BuddyBudget"`, 4 entries in `icons`, each with a `src` that responds 200:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/icons/icon-192.png
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/icons/icon-512.png
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/icons/apple-touch-icon.png
```

Expected: `200` for all three.

- [ ] **Step 5: Commit**

```bash
git add app/manifest.ts app/layout.tsx
git commit -m "feat(pwa): manifest installabile + meta apple-web-app

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Final check

**Files:** none (check only, no changes).

**Interfaces:**
- Consumes: the whole work of Tasks 1-6.
- Produces: confirmation that the branch is ready for final review/merge.

- [ ] **Step 1: Full build and typecheck**

```bash
pnpm tsc --noEmit
pnpm build
pnpm lint
```

Expected: all three clean (no new errors compared to the pre-existing ones already known in CLAUDE.md — check that any remaining errors are only the already documented ones, e.g. `react-hooks/set-state-in-effect` in `theme-toggle.tsx`/`CategoryLegendRow`).

- [ ] **Step 2: Safety grep — no hardcoded hex introduced outside `globals.css`**

```bash
grep -rn "#0f0f3f\|#219ebc\|#ffb703\|#187e98" --include="*.tsx" --include="*.ts" app components | grep -v globals.css
```

Expected: no results (all color references in components go through tokens, as required by the Global Constraints).

- [ ] **Step 3: Visual check of the main screens (dev server)**

```bash
pnpm dev
```

Check in both themes (light/dark, toggle in the sidebar): `/panoramica`, `/conti`, `/transazioni`, `/cash-flow`, `/categorie`, login page (`/login`), `/style-guide`. Check in particular (Review Focus): text readability on the navy sidebar, readability of the login panel, no element that assumed a light sidebar background is now invisible.

- [ ] **Step 4: Update CLAUDE.md**

Add an entry to the decision log (`CLAUDE.md`, "Log delle decisioni" (Decision log) section) describing: palette replaced with the navy/light blue/yellow brand from the designer's logo package, behavior change with a fixed navy sidebar in both themes, installable PWA via `app/manifest.ts` (no service worker/offline), assets in `public/brand/`+`public/icons/`. Update "Stato del progetto" (Project status) if the overall status changes.

- [ ] **Step 5: Final commit**

```bash
git add CLAUDE.md
git commit -m "docs: aggiorna CLAUDE.md con brand identity + PWA

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
