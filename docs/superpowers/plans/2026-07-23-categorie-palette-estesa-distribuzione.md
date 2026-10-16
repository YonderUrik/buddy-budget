# Extended color/icon palette + automatic color distribution — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the color palette shared by Conti/Categorie (Accounts/Categories) from 8 to 48 values (16 base + 32 light/dark variants) and the category icons from 28 to 60, plus a "Distribuisci colori" ("Distribute colors") button in `/categorie` that automatically reassigns a unique color to each non-fallback category.

**Architecture:** No DB migration (`color`/`icon` are `text` columns). Extension of the existing TS/Zod enums (`shared-colors.ts`, `categories.ts`) and of the rendering maps (`color-swatches.ts`, `category-avatar.tsx`). New pure function `distributeColors` (`lib/calc/`) consumed by a new atomic endpoint `POST /api/categories/distribute-colors`, exposed via a new TanStack Query mutation and a dedicated domain component.

**Tech Stack:** Next.js Route Handlers, Drizzle ORM (Postgres), Zod, TanStack Query, `@base-ui/react` (AlertDialog/Popover), Tailwind CSS v4, lucide-react, Vitest.

## Global Constraints

- No hexadecimal colors or hardcoded radii in components: always use Tailwind classes or `var(--nome-token)` (CLAUDE.md "Design token" rule).
- Every public component/function has a minimal one-line JSDoc.
- The barrel file (`components/domain/categories/index.ts`) is the only import point for external consumers.
- No business logic in `app/*/page.tsx`.
- Spec reference: `docs/superpowers/specs/2026-07-23-categorie-palette-estesa-distribuzione-design.md`.

---

### Task 1: Extended color palette — shared enum

**Files:**
- Modify: `lib/validation/shared-colors.ts`
- Modify: `lib/validation/shared-colors.test.ts`
- Modify: `lib/validation/categories.test.ts:64-66`

**Interfaces:**
- Produces: `SWATCH_BASE_COLORS: readonly SwatchBaseColor[]` (16 elements, fixed order), `SWATCH_COLORS: readonly SwatchColor[]` (48 elements, order `[...16 base, ...16 light, ...16 dark]`), `type SwatchColor`, `type SwatchBaseColor`.

- [ ] **Step 1: Write the failing test**

Replace the contents of `lib/validation/shared-colors.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SWATCH_BASE_COLORS, SWATCH_COLORS } from "./shared-colors";
import { ACCOUNT_COLORS } from "./accounts";
import { CATEGORY_COLORS } from "./categories";

describe("SWATCH_BASE_COLORS", () => {
  it("ha 16 colori base, nessun duplicato", () => {
    expect(SWATCH_BASE_COLORS).toHaveLength(16);
    expect(new Set(SWATCH_BASE_COLORS).size).toBe(16);
  });
});

describe("SWATCH_COLORS", () => {
  it("ha 48 colori (16 base + 32 varianti), nessun duplicato", () => {
    expect(SWATCH_COLORS).toHaveLength(48);
    expect(new Set(SWATCH_COLORS).size).toBe(48);
  });

  it("inizia con i 16 colori base nello stesso ordine di SWATCH_BASE_COLORS", () => {
    expect(SWATCH_COLORS.slice(0, 16)).toEqual(SWATCH_BASE_COLORS);
  });

  it("ogni colore base ha una variante -light e una -dark nel pool", () => {
    for (const base of SWATCH_BASE_COLORS) {
      expect(SWATCH_COLORS).toContain(`${base}-light`);
      expect(SWATCH_COLORS).toContain(`${base}-dark`);
    }
  });

  it("ACCOUNT_COLORS e CATEGORY_COLORS puntano alla stessa palette condivisa", () => {
    expect(ACCOUNT_COLORS).toEqual(SWATCH_COLORS);
    expect(CATEGORY_COLORS).toEqual(SWATCH_COLORS);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `pnpm test -- shared-colors.test.ts`
Expected: FAIL — `SWATCH_BASE_COLORS` not exported, `SWATCH_COLORS` still has 8 elements.

- [ ] **Step 3: Rewrite `lib/validation/shared-colors.ts`**

```ts
/**
 * Color palette shared by Conti and Categorie: 16 base colors + one light variant
 * and one dark variant for each (32), for a total of 48. The variants cannot be selected
 * manually in the pickers (only the 16 base ones) — they exist for the automatic distribution of
 * colors when categories exceed the 16 base colors without repetitions.
 */
export const SWATCH_BASE_COLORS = [
  "slate", "blue", "green", "yellow", "purple", "orange", "red", "teal",
  "pink", "indigo", "cyan", "lime", "amber", "rose", "violet", "emerald",
] as const;
export type SwatchBaseColor = (typeof SWATCH_BASE_COLORS)[number];

const SWATCH_LIGHT_COLORS = [
  "slate-light", "blue-light", "green-light", "yellow-light", "purple-light", "orange-light",
  "red-light", "teal-light", "pink-light", "indigo-light", "cyan-light", "lime-light",
  "amber-light", "rose-light", "violet-light", "emerald-light",
] as const;

const SWATCH_DARK_COLORS = [
  "slate-dark", "blue-dark", "green-dark", "yellow-dark", "purple-dark", "orange-dark",
  "red-dark", "teal-dark", "pink-dark", "indigo-dark", "cyan-dark", "lime-dark",
  "amber-dark", "rose-dark", "violet-dark", "emerald-dark",
] as const;

export const SWATCH_COLORS = [
  ...SWATCH_BASE_COLORS,
  ...SWATCH_LIGHT_COLORS,
  ...SWATCH_DARK_COLORS,
] as const;
export type SwatchColor = (typeof SWATCH_COLORS)[number];
```

- [ ] **Step 4: Update the length assert in `lib/validation/categories.test.ts`**

In `lib/validation/categories.test.ts:63-67`, replace:

```ts
describe("CATEGORY_COLORS", () => {
  it("ha 48 colori (stessa palette dei conti)", () => {
    expect(CATEGORY_COLORS).toHaveLength(48);
  });
});
```

In the same file, at the line of the test `"rifiuta un colore fuori enum"` (lines 45-48), the value `"pink"` is now valid (it joined the base palette) — replace it with a value that is certainly outside the enum:

```ts
  it("rifiuta un colore fuori enum", () => {
    const result = createCategorySchema.safeParse({ name: "Palestra", type: "variabile", color: "brown" });
    expect(result.success).toBe(false);
  });
```

- [ ] **Step 5: Run the tests, verify they pass**

Run: `pnpm test -- shared-colors.test.ts categories.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/validation/shared-colors.ts lib/validation/shared-colors.test.ts lib/validation/categories.test.ts
git commit -m "feat: espandi palette colori condivisa da 8 a 48 (16 base + varianti)"
```

---

### Task 2: CSS vars for the new colors (chart fill)

**Files:**
- Modify: `app/globals.css:88-95` (`:root` block) and `:138-145` (`.dark` block)

**Interfaces:**
- Consumes: none (static data only).
- Produces: 40 new CSS custom properties `--swatch-{token}` (8 new base + 32 variants), read by `SWATCH_CHART_COLOR` in Task 3.

- [ ] **Step 1: Add the missing vars in the `:root` block (after the line `--swatch-teal: #14b8a6;`, line 95)**

```css
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
```

- [ ] **Step 2: Add the same identical block in the `.dark` block** (after `--swatch-teal: #14b8a6;` at line 145 — same pattern as the existing code, where the base colors are already identical between `:root` and `.dark`)

The exact same 40-line block as Step 1.

- [ ] **Step 3: Manual check — no automated test for static CSS variables**

Run: `pnpm build`
Expected: build passes without errors (pure CSS, no TypeScript impact).

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "feat: aggiungi CSS vars per i nuovi colori palette (base+varianti)"
```

---

### Task 3: Color rendering maps (avatar, dot, chart)

**Files:**
- Modify: `components/domain/shared/color-swatches.ts`

**Interfaces:**
- Consumes: `SwatchColor` (Task 1), CSS vars `--swatch-*` (Task 2).
- Produces: `COLOR_SWATCH_MAP`, `COLOR_DOT`, `SWATCH_CHART_COLOR` keyed by `Record<SwatchColor, ...>` (48 entries), consumed by `CategoryAvatar`/`AccountAvatar` (Task 6) and by the pickers (Task 4).

- [ ] **Step 1: Rewrite `components/domain/shared/color-swatches.ts`**

```ts
/**
 * Color -> Tailwind classes map (avatar bg/fg, solid dot) shared by accounts and categories.
 * Covers the 16 base colors and the 32 derived light/dark variants (used only by the
 * automatic color distribution, not selectable manually in the pickers).
 */

import type { SwatchColor } from "@/lib/validation/shared-colors";

export const COLOR_SWATCH_MAP: Record<SwatchColor, { bg: string; fg: string }> = {
  slate: { bg: "bg-slate-100 dark:bg-slate-800", fg: "text-slate-500 dark:text-slate-400" },
  blue: { bg: "bg-blue-100 dark:bg-blue-900/40", fg: "text-blue-600 dark:text-blue-400" },
  green: { bg: "bg-green-100 dark:bg-green-900/40", fg: "text-green-600 dark:text-green-400" },
  yellow: { bg: "bg-yellow-100 dark:bg-yellow-900/40", fg: "text-yellow-600 dark:text-yellow-400" },
  purple: { bg: "bg-purple-100 dark:bg-purple-900/40", fg: "text-purple-600 dark:text-purple-400" },
  orange: { bg: "bg-orange-100 dark:bg-orange-900/40", fg: "text-orange-600 dark:text-orange-400" },
  red: { bg: "bg-red-100 dark:bg-red-900/40", fg: "text-red-600 dark:text-red-400" },
  teal: { bg: "bg-teal-100 dark:bg-teal-900/40", fg: "text-teal-600 dark:text-teal-400" },
  pink: { bg: "bg-pink-100 dark:bg-pink-900/40", fg: "text-pink-600 dark:text-pink-400" },
  indigo: { bg: "bg-indigo-100 dark:bg-indigo-900/40", fg: "text-indigo-600 dark:text-indigo-400" },
  cyan: { bg: "bg-cyan-100 dark:bg-cyan-900/40", fg: "text-cyan-600 dark:text-cyan-400" },
  lime: { bg: "bg-lime-100 dark:bg-lime-900/40", fg: "text-lime-600 dark:text-lime-400" },
  amber: { bg: "bg-amber-100 dark:bg-amber-900/40", fg: "text-amber-600 dark:text-amber-400" },
  rose: { bg: "bg-rose-100 dark:bg-rose-900/40", fg: "text-rose-600 dark:text-rose-400" },
  violet: { bg: "bg-violet-100 dark:bg-violet-900/40", fg: "text-violet-600 dark:text-violet-400" },
  emerald: { bg: "bg-emerald-100 dark:bg-emerald-900/40", fg: "text-emerald-600 dark:text-emerald-400" },
  "slate-light": { bg: "bg-slate-50 dark:bg-slate-800/40", fg: "text-slate-500 dark:text-slate-300" },
  "blue-light": { bg: "bg-blue-50 dark:bg-blue-800/40", fg: "text-blue-500 dark:text-blue-300" },
  "green-light": { bg: "bg-green-50 dark:bg-green-800/40", fg: "text-green-500 dark:text-green-300" },
  "yellow-light": { bg: "bg-yellow-50 dark:bg-yellow-800/40", fg: "text-yellow-500 dark:text-yellow-300" },
  "purple-light": { bg: "bg-purple-50 dark:bg-purple-800/40", fg: "text-purple-500 dark:text-purple-300" },
  "orange-light": { bg: "bg-orange-50 dark:bg-orange-800/40", fg: "text-orange-500 dark:text-orange-300" },
  "red-light": { bg: "bg-red-50 dark:bg-red-800/40", fg: "text-red-500 dark:text-red-300" },
  "teal-light": { bg: "bg-teal-50 dark:bg-teal-800/40", fg: "text-teal-500 dark:text-teal-300" },
  "pink-light": { bg: "bg-pink-50 dark:bg-pink-800/40", fg: "text-pink-500 dark:text-pink-300" },
  "indigo-light": { bg: "bg-indigo-50 dark:bg-indigo-800/40", fg: "text-indigo-500 dark:text-indigo-300" },
  "cyan-light": { bg: "bg-cyan-50 dark:bg-cyan-800/40", fg: "text-cyan-500 dark:text-cyan-300" },
  "lime-light": { bg: "bg-lime-50 dark:bg-lime-800/40", fg: "text-lime-500 dark:text-lime-300" },
  "amber-light": { bg: "bg-amber-50 dark:bg-amber-800/40", fg: "text-amber-500 dark:text-amber-300" },
  "rose-light": { bg: "bg-rose-50 dark:bg-rose-800/40", fg: "text-rose-500 dark:text-rose-300" },
  "violet-light": { bg: "bg-violet-50 dark:bg-violet-800/40", fg: "text-violet-500 dark:text-violet-300" },
  "emerald-light": { bg: "bg-emerald-50 dark:bg-emerald-800/40", fg: "text-emerald-500 dark:text-emerald-300" },
  "slate-dark": { bg: "bg-slate-200 dark:bg-slate-950/60", fg: "text-slate-700 dark:text-slate-300" },
  "blue-dark": { bg: "bg-blue-200 dark:bg-blue-950/60", fg: "text-blue-700 dark:text-blue-300" },
  "green-dark": { bg: "bg-green-200 dark:bg-green-950/60", fg: "text-green-700 dark:text-green-300" },
  "yellow-dark": { bg: "bg-yellow-200 dark:bg-yellow-950/60", fg: "text-yellow-700 dark:text-yellow-300" },
  "purple-dark": { bg: "bg-purple-200 dark:bg-purple-950/60", fg: "text-purple-700 dark:text-purple-300" },
  "orange-dark": { bg: "bg-orange-200 dark:bg-orange-950/60", fg: "text-orange-700 dark:text-orange-300" },
  "red-dark": { bg: "bg-red-200 dark:bg-red-950/60", fg: "text-red-700 dark:text-red-300" },
  "teal-dark": { bg: "bg-teal-200 dark:bg-teal-950/60", fg: "text-teal-700 dark:text-teal-300" },
  "pink-dark": { bg: "bg-pink-200 dark:bg-pink-950/60", fg: "text-pink-700 dark:text-pink-300" },
  "indigo-dark": { bg: "bg-indigo-200 dark:bg-indigo-950/60", fg: "text-indigo-700 dark:text-indigo-300" },
  "cyan-dark": { bg: "bg-cyan-200 dark:bg-cyan-950/60", fg: "text-cyan-700 dark:text-cyan-300" },
  "lime-dark": { bg: "bg-lime-200 dark:bg-lime-950/60", fg: "text-lime-700 dark:text-lime-300" },
  "amber-dark": { bg: "bg-amber-200 dark:bg-amber-950/60", fg: "text-amber-700 dark:text-amber-300" },
  "rose-dark": { bg: "bg-rose-200 dark:bg-rose-950/60", fg: "text-rose-700 dark:text-rose-300" },
  "violet-dark": { bg: "bg-violet-200 dark:bg-violet-950/60", fg: "text-violet-700 dark:text-violet-300" },
  "emerald-dark": { bg: "bg-emerald-200 dark:bg-emerald-950/60", fg: "text-emerald-700 dark:text-emerald-300" },
};

export const COLOR_DOT: Record<SwatchColor, string> = {
  slate: "bg-slate-400",
  blue: "bg-blue-500",
  green: "bg-green-500",
  yellow: "bg-yellow-400",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
  red: "bg-red-500",
  teal: "bg-teal-500",
  pink: "bg-pink-500",
  indigo: "bg-indigo-500",
  cyan: "bg-cyan-500",
  lime: "bg-lime-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  violet: "bg-violet-500",
  emerald: "bg-emerald-500",
  "slate-light": "bg-slate-300",
  "blue-light": "bg-blue-300",
  "green-light": "bg-green-300",
  "yellow-light": "bg-yellow-300",
  "purple-light": "bg-purple-300",
  "orange-light": "bg-orange-300",
  "red-light": "bg-red-300",
  "teal-light": "bg-teal-300",
  "pink-light": "bg-pink-300",
  "indigo-light": "bg-indigo-300",
  "cyan-light": "bg-cyan-300",
  "lime-light": "bg-lime-300",
  "amber-light": "bg-amber-300",
  "rose-light": "bg-rose-300",
  "violet-light": "bg-violet-300",
  "emerald-light": "bg-emerald-300",
  "slate-dark": "bg-slate-700",
  "blue-dark": "bg-blue-700",
  "green-dark": "bg-green-700",
  "yellow-dark": "bg-yellow-700",
  "purple-dark": "bg-purple-700",
  "orange-dark": "bg-orange-700",
  "red-dark": "bg-red-700",
  "teal-dark": "bg-teal-700",
  "pink-dark": "bg-pink-700",
  "indigo-dark": "bg-indigo-700",
  "cyan-dark": "bg-cyan-700",
  "lime-dark": "bg-lime-700",
  "amber-dark": "bg-amber-700",
  "rose-dark": "bg-rose-700",
  "violet-dark": "bg-violet-700",
  "emerald-dark": "bg-emerald-700",
};

/** Color -> CSS var map for the multilevel pie (recharts requires a literal value, not a Tailwind class). */
export const SWATCH_CHART_COLOR: Record<SwatchColor, string> = {
  slate: "var(--swatch-slate)",
  blue: "var(--swatch-blue)",
  green: "var(--swatch-green)",
  yellow: "var(--swatch-yellow)",
  purple: "var(--swatch-purple)",
  orange: "var(--swatch-orange)",
  red: "var(--swatch-red)",
  teal: "var(--swatch-teal)",
  pink: "var(--swatch-pink)",
  indigo: "var(--swatch-indigo)",
  cyan: "var(--swatch-cyan)",
  lime: "var(--swatch-lime)",
  amber: "var(--swatch-amber)",
  rose: "var(--swatch-rose)",
  violet: "var(--swatch-violet)",
  emerald: "var(--swatch-emerald)",
  "slate-light": "var(--swatch-slate-light)",
  "blue-light": "var(--swatch-blue-light)",
  "green-light": "var(--swatch-green-light)",
  "yellow-light": "var(--swatch-yellow-light)",
  "purple-light": "var(--swatch-purple-light)",
  "orange-light": "var(--swatch-orange-light)",
  "red-light": "var(--swatch-red-light)",
  "teal-light": "var(--swatch-teal-light)",
  "pink-light": "var(--swatch-pink-light)",
  "indigo-light": "var(--swatch-indigo-light)",
  "cyan-light": "var(--swatch-cyan-light)",
  "lime-light": "var(--swatch-lime-light)",
  "amber-light": "var(--swatch-amber-light)",
  "rose-light": "var(--swatch-rose-light)",
  "violet-light": "var(--swatch-violet-light)",
  "emerald-light": "var(--swatch-emerald-light)",
  "slate-dark": "var(--swatch-slate-dark)",
  "blue-dark": "var(--swatch-blue-dark)",
  "green-dark": "var(--swatch-green-dark)",
  "yellow-dark": "var(--swatch-yellow-dark)",
  "purple-dark": "var(--swatch-purple-dark)",
  "orange-dark": "var(--swatch-orange-dark)",
  "red-dark": "var(--swatch-red-dark)",
  "teal-dark": "var(--swatch-teal-dark)",
  "pink-dark": "var(--swatch-pink-dark)",
  "indigo-dark": "var(--swatch-indigo-dark)",
  "cyan-dark": "var(--swatch-cyan-dark)",
  "lime-dark": "var(--swatch-lime-dark)",
  "amber-dark": "var(--swatch-amber-dark)",
  "rose-dark": "var(--swatch-rose-dark)",
  "violet-dark": "var(--swatch-violet-dark)",
  "emerald-dark": "var(--swatch-emerald-dark)",
};
```

- [ ] **Step 2: Verify the typecheck**

Run: `pnpm build`
Expected: passes without TypeScript errors (no `SwatchColor` key missing in the three `Record`s).

- [ ] **Step 3: Commit**

```bash
git add components/domain/shared/color-swatches.ts
git commit -m "feat: estendi mappe rendering colore (avatar/dot/chart) a 48 valori"
```

---

### Task 4: Manual picker — only the 16 base colors

**Files:**
- Modify: `components/domain/categories/category-icon-color-picker.tsx:11,31`
- Modify: `components/domain/accounts/account-icon-color-picker.tsx:8,36`

**Interfaces:**
- Consumes: `SWATCH_BASE_COLORS` (Task 1).
- Produces: no new public interface — visual behavior of the existing pickers unchanged in form (color grid), only the data source changes from 8/48 to 16.

- [ ] **Step 1: `category-icon-color-picker.tsx` — import and use `SWATCH_BASE_COLORS`**

In `components/domain/categories/category-icon-color-picker.tsx:11`, replace:
```ts
import { SWATCH_COLORS } from "@/lib/validation/shared-colors";
```
with:
```ts
import { SWATCH_BASE_COLORS } from "@/lib/validation/shared-colors";
```

At line 31, replace `{SWATCH_COLORS.map((color) => (` with `{SWATCH_BASE_COLORS.map((color) => (`.

- [ ] **Step 2: `account-icon-color-picker.tsx` — introduce the same filter**

`ACCOUNT_COLORS` (in `lib/validation/accounts.ts:12`) stays `= SWATCH_COLORS` (48, used for Zod validation — correct, do not touch). For the picker, in `components/domain/accounts/account-icon-color-picker.tsx:8`, add the import of `SWATCH_BASE_COLORS` next to the existing one:

```ts
import { ACCOUNT_ICONS } from "@/lib/validation/accounts";
import { SWATCH_BASE_COLORS } from "@/lib/validation/shared-colors";
```

(remove `ACCOUNT_COLORS` from the existing import, it is no longer needed in this file). At line 36, replace `{ACCOUNT_COLORS.map((color) => (` with `{SWATCH_BASE_COLORS.map((color) => (`.

- [ ] **Step 3: Verify the typecheck**

Run: `pnpm build`
Expected: passes without errors (`color` in the two pickers stays typed `SwatchColor`, a valid subset).

- [ ] **Step 4: Commit**

```bash
git add components/domain/categories/category-icon-color-picker.tsx components/domain/accounts/account-icon-color-picker.tsx
git commit -m "feat: limita i picker manuali ai 16 colori base"
```

---

### Task 5: Extended category icons (28 → 60)

**Files:**
- Modify: `lib/validation/categories.ts:7-13`
- Modify: `lib/validation/categories.test.ts:4-7`
- Modify: `components/domain/categories/category-avatar.tsx:4-44`

**Interfaces:**
- Produces: `CATEGORY_ICONS` (60 elements), `ICON_MAP: Record<CategoryIcon, LucideIcon>` (60 entries), consumed by the picker (unchanged, it already iterates over `CATEGORY_ICONS`) and by `CategoryAvatar`.

- [ ] **Step 1: Update the length test in `lib/validation/categories.test.ts:4-7`**

```ts
describe("CATEGORY_ICONS", () => {
  it("ha 60 icone", () => {
    expect(CATEGORY_ICONS).toHaveLength(60);
  });

  it("non ha duplicati", () => {
    expect(new Set(CATEGORY_ICONS).size).toBe(CATEGORY_ICONS.length);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `pnpm test -- categories.test.ts`
Expected: FAIL — `CATEGORY_ICONS` still has 28 elements.

- [ ] **Step 3: Extend `CATEGORY_ICONS` in `lib/validation/categories.ts:7-13`**

```ts
export const CATEGORY_ICONS = [
  "utensils", "shopping-cart", "home", "zap", "droplet", "wifi", "tv",
  "smartphone", "car", "bus", "plane", "fuel", "film", "gamepad-2",
  "music", "heart", "stethoscope", "dumbbell", "graduation-cap", "baby",
  "paw-print", "shirt", "scissors", "gift", "briefcase", "wrench",
  "package", "help-circle",
  "wallet", "credit-card", "piggy-bank", "banknote", "landmark", "receipt",
  "trending-up", "coins", "flame", "sofa", "hammer", "paintbrush",
  "laptop", "headphones", "camera", "printer", "train-front", "ship",
  "map-pin", "luggage", "coffee", "pizza", "wine", "cake", "pill",
  "activity", "glasses", "book-open", "palette", "bike", "calculator",
  "watch",
] as const;
export type CategoryIcon = (typeof CATEGORY_ICONS)[number];
```

- [ ] **Step 4: Add the 32 new icons to `ICON_MAP` in `components/domain/categories/category-avatar.tsx`**

Replace the import block (lines 4-9) with:

```ts
import {
  Utensils, ShoppingCart, Home, Zap, Droplet, Wifi, Tv, Smartphone,
  Car, Bus, Plane, Fuel, Film, Gamepad2, Music, Heart, Stethoscope,
  Dumbbell, GraduationCap, Baby, PawPrint, Shirt, Scissors, Gift,
  Briefcase, Wrench, Package, HelpCircle,
  Wallet, CreditCard, PiggyBank, Banknote, Landmark, Receipt,
  TrendingUp, Coins, Flame, Sofa, Hammer, Paintbrush,
  Laptop, Headphones, Camera, Printer, TrainFront, Ship,
  MapPin, Luggage, Coffee, Pizza, Wine, Cake, Pill,
  Activity, Glasses, BookOpen, Palette, Bike, Calculator,
  Watch,
} from "lucide-react";
```

Replace the `ICON_MAP` block (lines 15-44) with:

```ts
export const ICON_MAP: Record<CategoryIcon, LucideIcon> = {
  utensils: Utensils,
  "shopping-cart": ShoppingCart,
  home: Home,
  zap: Zap,
  droplet: Droplet,
  wifi: Wifi,
  tv: Tv,
  smartphone: Smartphone,
  car: Car,
  bus: Bus,
  plane: Plane,
  fuel: Fuel,
  film: Film,
  "gamepad-2": Gamepad2,
  music: Music,
  heart: Heart,
  stethoscope: Stethoscope,
  dumbbell: Dumbbell,
  "graduation-cap": GraduationCap,
  baby: Baby,
  "paw-print": PawPrint,
  shirt: Shirt,
  scissors: Scissors,
  gift: Gift,
  briefcase: Briefcase,
  wrench: Wrench,
  package: Package,
  "help-circle": HelpCircle,
  wallet: Wallet,
  "credit-card": CreditCard,
  "piggy-bank": PiggyBank,
  banknote: Banknote,
  landmark: Landmark,
  receipt: Receipt,
  "trending-up": TrendingUp,
  coins: Coins,
  flame: Flame,
  sofa: Sofa,
  hammer: Hammer,
  paintbrush: Paintbrush,
  laptop: Laptop,
  headphones: Headphones,
  camera: Camera,
  printer: Printer,
  "train-front": TrainFront,
  ship: Ship,
  "map-pin": MapPin,
  luggage: Luggage,
  coffee: Coffee,
  pizza: Pizza,
  wine: Wine,
  cake: Cake,
  pill: Pill,
  activity: Activity,
  glasses: Glasses,
  "book-open": BookOpen,
  palette: Palette,
  bike: Bike,
  calculator: Calculator,
  watch: Watch,
};
```

- [ ] **Step 5: Run the tests and the typecheck**

Run: `pnpm test -- categories.test.ts && pnpm build`
Expected: PASS — icon test green, build passes (confirms that all the imported Lucide names really exist in `lucide-react`; if a name does not exist, `pnpm build` fails with an import error and must be fixed with the exact name from the installed package).

- [ ] **Step 6: Commit**

```bash
git add lib/validation/categories.ts lib/validation/categories.test.ts components/domain/categories/category-avatar.tsx
git commit -m "feat: espandi icone categoria da 28 a 60"
```

---

### Task 6: Pure color distribution function

**Files:**
- Create: `lib/calc/distribute-colors.ts`
- Create: `lib/calc/distribute-colors.test.ts`

**Interfaces:**
- Consumes: `SWATCH_COLORS` (Task 1).
- Produces: `distributeColors(categoryIds: string[]): Record<string, SwatchColor>`, consumed by the endpoint in Task 7.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { distributeColors } from "./distribute-colors";
import { SWATCH_COLORS } from "@/lib/validation/shared-colors";

function ids(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `cat-${i}`);
}

describe("distributeColors", () => {
  it("ritorna un oggetto vuoto per lista vuota", () => {
    expect(distributeColors([])).toEqual({});
  });

  it("assegna il primo colore del pool a una singola categoria", () => {
    const result = distributeColors(ids(1));
    expect(result["cat-0"]).toBe(SWATCH_COLORS[0]);
  });

  it("con 16 categorie assegna tutti i colori base senza ripetizioni", () => {
    const result = distributeColors(ids(16));
    const values = Object.values(result);
    expect(new Set(values).size).toBe(16);
    expect(values).toEqual(SWATCH_COLORS.slice(0, 16));
  });

  it("con 17 categorie usa una variante per la 17esima, distinta dalla precedente", () => {
    const list = ids(17);
    const result = distributeColors(list);
    expect(Object.values(result).length).toBe(17);
    expect(new Set(Object.values(result)).size).toBe(17);
    expect(result[list[16]]).toBe(SWATCH_COLORS[16]);
    expect(result[list[16]]).not.toBe(result[list[15]]);
  });

  it("con 48 categorie usa l'intero pool senza ripetizioni", () => {
    const result = distributeColors(ids(48));
    expect(new Set(Object.values(result)).size).toBe(48);
  });

  it("con 49 categorie il colore si ripete ma mai su elementi adiacenti", () => {
    const list = ids(49);
    const result = distributeColors(list);
    for (let i = 1; i < list.length; i++) {
      expect(result[list[i]]).not.toBe(result[list[i - 1]]);
    }
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `pnpm test -- distribute-colors.test.ts`
Expected: FAIL with "Cannot find module './distribute-colors'"

- [ ] **Step 3: Implement `lib/calc/distribute-colors.ts`**

```ts
import { SWATCH_COLORS } from "@/lib/validation/shared-colors";
import type { SwatchColor } from "@/lib/validation/shared-colors";

/**
 * Assigns a color to each category id (in the order passed, typically createdAt asc)
 * drawing from the pool of 48 colors without repetitions as long as possible. Beyond 48 elements the
 * pool repeats cyclically, but it never assigns the same color to two adjacent elements.
 */
export function distributeColors(categoryIds: string[]): Record<string, SwatchColor> {
  const assignment: Record<string, SwatchColor> = {};
  const poolSize = SWATCH_COLORS.length;
  let previousColor: SwatchColor | null = null;

  categoryIds.forEach((id, index) => {
    let color = SWATCH_COLORS[index % poolSize];
    if (color === previousColor) {
      color = SWATCH_COLORS[(index + 1) % poolSize];
    }
    assignment[id] = color;
    previousColor = color;
  });

  return assignment;
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `pnpm test -- distribute-colors.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/calc/distribute-colors.ts lib/calc/distribute-colors.test.ts
git commit -m "feat: aggiungi funzione pura distributeColors per l'assegnazione automatica colori"
```

---

### Task 7: Endpoint `POST /api/categories/distribute-colors`

**Files:**
- Create: `app/api/categories/distribute-colors/route.ts`
- Create: `app/api/categories/distribute-colors/route.test.ts`

**Interfaces:**
- Consumes: `distributeColors` (Task 6), `db`/`categories` (`@/lib/db/client`, `@/lib/db/schema/categories`), `auth` (`@/lib/auth`).
- Produces: `POST` handler that returns `200` with the updated `Category[]` (new colors), consumed by the mutation in Task 8.

- [ ] **Step 1: Write the failing integration test**

```ts
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { categories } from "@/lib/db/schema/categories";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { POST } from "./route";

const mockedGetSession = vi.mocked(auth.api.getSession);

describe("POST /api/categories/distribute-colors", () => {
  let userId: string;

  beforeEach(async () => {
    const testId = `test-distribute-colors-${crypto.randomUUID()}`;
    const [user] = await db
      .insert(authUser)
      .values({
        id: testId,
        name: "Test User",
        email: `test-distribute-colors-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    userId = user.id;
    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("risponde 401 senza sessione", async () => {
    mockedGetSession.mockResolvedValueOnce(null as never);
    const response = await POST(new NextRequest("http://localhost/api/categories/distribute-colors", { method: "POST" }));
    expect(response.status).toBe(401);
  });

  it("ritorna lista vuota se non ci sono categorie non-fallback", async () => {
    const response = await POST(new NextRequest("http://localhost/api/categories/distribute-colors", { method: "POST" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  it("assegna colori distinti alle categorie non-fallback e non tocca la fallback", async () => {
    await db.insert(categories).values([
      { userId, name: "Affitto", type: "fissa", color: "blue" },
      { userId, name: "Svago", type: "variabile", color: "blue" },
      { userId, name: "Da categorizzare", type: "variabile", color: "red", isFallback: true },
    ]);

    const response = await POST(new NextRequest("http://localhost/api/categories/distribute-colors", { method: "POST" }));
    expect(response.status).toBe(200);
    const updated: { name: string; color: string; isFallback: boolean }[] = await response.json();

    expect(updated).toHaveLength(2);
    const colors = updated.map((c) => c.color);
    expect(new Set(colors).size).toBe(2);

    const [stillFallback] = await db
      .select()
      .from(categories)
      .where(and(eq(categories.userId, userId), eq(categories.isFallback, true)));
    expect(stillFallback?.color).toBe("red");
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `pnpm test -- app/api/categories/distribute-colors/route.test.ts`
Expected: FAIL — `./route` does not exist. (Note: requires a reachable local Postgres, like the other existing route tests — if not available in this environment, proceed with the implementation anyway and flag that the check must be done by the user locally, per the convention already established in the project.)

- [ ] **Step 3: Implement `app/api/categories/distribute-colors/route.ts`**

```ts
import { NextRequest } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { categories } from "@/lib/db/schema/categories";
import { distributeColors } from "@/lib/calc/distribute-colors";

/**
 * POST /api/categories/distribute-colors — reassigns a unique color (from the pool of 48)
 * to each non-fallback category of the user, in creation order; the fallback category
 * ("Da categorizzare") is never touched. Applies all the updates in a single
 * transaction: if anything fails, no category is modified.
 */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }

  const userCategories = await db
    .select()
    .from(categories)
    .where(and(eq(categories.userId, session.user.id), eq(categories.isFallback, false)))
    .orderBy(asc(categories.createdAt));

  const assignment = distributeColors(userCategories.map((c) => c.id));

  const updated = await db.transaction(async (tx) => {
    const results = [];
    for (const category of userCategories) {
      const [row] = await tx
        .update(categories)
        .set({ color: assignment[category.id] })
        .where(eq(categories.id, category.id))
        .returning();
      results.push(row);
    }
    return results;
  });

  return Response.json(updated);
}
```

- [ ] **Step 4: Run the test, verify it passes (if DB available)**

Run: `pnpm test -- app/api/categories/distribute-colors/route.test.ts`
Expected: PASS (in an environment with a reachable local Postgres — same constraint as the other route tests in this repo).

- [ ] **Step 5: Commit**

```bash
git add app/api/categories/distribute-colors/route.ts app/api/categories/distribute-colors/route.test.ts
git commit -m "feat: aggiungi endpoint POST /api/categories/distribute-colors"
```

---

### Task 8: Mutation TanStack Query

**Files:**
- Modify: `lib/queries/categories.ts`

**Interfaces:**
- Consumes: endpoint `POST /api/categories/distribute-colors` (Task 7).
- Produces: `useDistributeColorsMutation()`, consumata dal componente UI nel Task 9.

- [ ] **Step 1: Add the mutation at the bottom of `lib/queries/categories.ts`**

```ts
/** Automatically redistributes the colors of the non-fallback categories and invalidates the list on success. */
export function useDistributeColorsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/categories/distribute-colors", { method: "POST" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Impossibile distribuire i colori");
      }
      return response.json() as Promise<Category[]>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
    },
  });
}
```

- [ ] **Step 2: Verify the typecheck**

Run: `pnpm build`
Expected: passes without errors.

- [ ] **Step 3: Commit**

```bash
git add lib/queries/categories.ts
git commit -m "feat: aggiungi useDistributeColorsMutation"
```

---

### Task 9: "Distribuisci colori" component + page integration

**Files:**
- Create: `components/domain/categories/distribute-colors-button.tsx`
- Modify: `components/domain/categories/index.ts`
- Modify: `app/(app)/categorie/page.tsx:1-28`

**Interfaces:**
- Consumes: `useDistributeColorsMutation` (Task 8), `AlertDialog*` (`@/components/ui/alert-dialog`).
- Produces: `DistributeColorsButton` (no props, self-contained component), exported from the `components/domain/categories` barrel.

- [ ] **Step 1: Create `components/domain/categories/distribute-colors-button.tsx`**

```tsx
"use client";

/** Button with confirmation that reassigns a unique color to each non-fallback category. */

import * as React from "react";
import { Shuffle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useDistributeColorsMutation } from "@/lib/queries/categories";

export function DistributeColorsButton() {
  const [open, setOpen] = React.useState(false);
  const mutation = useDistributeColorsMutation();

  function handleConfirm() {
    mutation.mutate(undefined, {
      onSuccess: () => setOpen(false),
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Shuffle size={14} />
            Distribuisci colori
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Distribuire i colori automaticamente?</AlertDialogTitle>
          <AlertDialogDescription>
            Ogni categoria (esclusa &quot;Da categorizzare&quot;) riceverà un colore diverso dalle altre.
            I colori attualmente assegnati manualmente verranno sovrascritti.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {mutation.isError && (
          <p className="text-sm text-destructive">Distribuzione non riuscita, riprova.</p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Annulla</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={mutation.isPending}>
            {mutation.isPending ? "Distribuzione..." : "Distribuisci"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 2: Export from the barrel `components/domain/categories/index.ts`**

Add at the bottom of the file:

```ts
export { DistributeColorsButton } from "./distribute-colors-button";
```

- [ ] **Step 3: Integrate the button in the header of `app/(app)/categorie/page.tsx`**

Update the import (line 5):

```ts
import { AddCategoryForm, CategoryRow, DistributeColorsButton } from "@/components/domain/categories";
```

In the header block (lines 15-28), add the button before the "Torna a Spese" link:

```tsx
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-medium text-foreground">Categorie</h1>
          <p className="text-sm text-muted-foreground">
            Gestisci le categorie di spesa: nome, tipo, icona e colore.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DistributeColorsButton />
          <a
            href="/spese"
            className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Torna a Spese
          </a>
        </div>
      </div>
```

- [ ] **Step 4: Verify the typecheck and the lint**

Run: `pnpm build && pnpm lint`
Expected: both pass without errors.

- [ ] **Step 5: Commit**

```bash
git add components/domain/categories/distribute-colors-button.tsx components/domain/categories/index.ts "app/(app)/categorie/page.tsx"
git commit -m "feat: aggiungi pulsante Distribuisci colori nella pagina Categorie"
```

---

## Final verification (whole-branch)

After the last task:

```bash
pnpm build
pnpm lint
pnpm test
```

Manual user verification (no Postgres/Redis in the agentic sandbox, as per the note already in CLAUDE.md for the previous category features): open `/categorie`, check that the picker shows 16 color dots, create/rename/recolor a category, then click "Distribuisci colori" with several existing categories and verify that the colors are all different from each other and that "Da categorizzare" stays red.
