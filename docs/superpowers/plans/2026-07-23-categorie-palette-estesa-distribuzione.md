# Palette colori/icone estesa + distribuzione automatica colori — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ampliare la palette colori condivisa Conti/Categorie da 8 a 48 valori (16 base + 32 varianti chiare/scure) e le icone categoria da 28 a 60, più un pulsante "Distribuisci colori" in `/categorie` che riassegna automaticamente un colore univoco a ogni categoria non-fallback.

**Architecture:** Nessuna migrazione DB (`color`/`icon` sono colonne `text`). Estensione degli enum TS/Zod esistenti (`shared-colors.ts`, `categories.ts`) e delle mappe di rendering (`color-swatches.ts`, `category-avatar.tsx`). Nuova funzione pura `distributeColors` (`lib/calc/`) consumata da un nuovo endpoint atomico `POST /api/categories/distribute-colors`, esposto via una nuova mutation TanStack Query e un componente dominio dedicato.

**Tech Stack:** Next.js Route Handlers, Drizzle ORM (Postgres), Zod, TanStack Query, `@base-ui/react` (AlertDialog/Popover), Tailwind CSS v4, lucide-react, Vitest.

## Global Constraints

- Nessun colore esadecimale o raggio hardcoded nei componenti: usare sempre classi Tailwind o `var(--nome-token)` (regola CLAUDE.md "Design token").
- Ogni componente/funzione pubblica ha una riga di JSDoc minima.
- Barrel file (`components/domain/categories/index.ts`) è l'unico punto di import per i consumer esterni.
- Nessuna logica di business in `app/*/page.tsx`.
- Riferimento allo spec: `docs/superpowers/specs/2026-07-23-categorie-palette-estesa-distribuzione-design.md`.

---

### Task 1: Palette colori estesa — enum condiviso

**Files:**
- Modify: `lib/validation/shared-colors.ts`
- Modify: `lib/validation/shared-colors.test.ts`
- Modify: `lib/validation/categories.test.ts:64-66`

**Interfaces:**
- Produces: `SWATCH_BASE_COLORS: readonly SwatchBaseColor[]` (16 elementi, ordine fisso), `SWATCH_COLORS: readonly SwatchColor[]` (48 elementi, ordine `[...16 base, ...16 light, ...16 dark]`), `type SwatchColor`, `type SwatchBaseColor`.

- [ ] **Step 1: Scrivi il test che fallisce**

Sostituisci il contenuto di `lib/validation/shared-colors.test.ts`:

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

- [ ] **Step 2: Esegui il test, verifica che fallisca**

Run: `pnpm test -- shared-colors.test.ts`
Expected: FAIL — `SWATCH_BASE_COLORS` non esportato, `SWATCH_COLORS` ha ancora 8 elementi.

- [ ] **Step 3: Riscrivi `lib/validation/shared-colors.ts`**

```ts
/**
 * Palette colori condivisa da Conti e Categorie: 16 colori base + una variante chiara
 * e una scura per ciascuno (32), per un totale di 48. Le varianti non sono selezionabili
 * manualmente nei picker (solo i 16 base) — esistono per la distribuzione automatica dei
 * colori quando le categorie superano i 16 base senza ripetizioni.
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

- [ ] **Step 4: Aggiorna l'assert di lunghezza in `lib/validation/categories.test.ts`**

In `lib/validation/categories.test.ts:63-67`, sostituisci:

```ts
describe("CATEGORY_COLORS", () => {
  it("ha 48 colori (stessa palette dei conti)", () => {
    expect(CATEGORY_COLORS).toHaveLength(48);
  });
});
```

Nello stesso file, alla riga del test `"rifiuta un colore fuori enum"` (riga 45-48), il valore `"pink"` ora è valido (è entrato nella palette base) — sostituiscilo con un valore certamente fuori enum:

```ts
  it("rifiuta un colore fuori enum", () => {
    const result = createCategorySchema.safeParse({ name: "Palestra", type: "variabile", color: "brown" });
    expect(result.success).toBe(false);
  });
```

- [ ] **Step 5: Esegui i test, verifica che passino**

Run: `pnpm test -- shared-colors.test.ts categories.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/validation/shared-colors.ts lib/validation/shared-colors.test.ts lib/validation/categories.test.ts
git commit -m "feat: espandi palette colori condivisa da 8 a 48 (16 base + varianti)"
```

---

### Task 2: CSS vars per i nuovi colori (chart fill)

**Files:**
- Modify: `app/globals.css:88-95` (blocco `:root`) e `:138-145` (blocco `.dark`)

**Interfaces:**
- Consumes: nessuno (solo dati statici).
- Produces: 40 nuove custom property CSS `--swatch-{token}` (8 nuovi base + 32 varianti), lette da `SWATCH_CHART_COLOR` nel Task 3.

- [ ] **Step 1: Aggiungi le var mancanti nel blocco `:root` (dopo la riga `--swatch-teal: #14b8a6;`, riga 95)**

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

- [ ] **Step 2: Aggiungi lo stesso blocco identico nel blocco `.dark`** (dopo `--swatch-teal: #14b8a6;` alla riga 145 — stesso pattern del codice esistente, dove i colori base sono già identici tra `:root` e `.dark`)

Stesso identico blocco di 40 righe dello Step 1.

- [ ] **Step 3: Verifica manuale — nessun test automatico per variabili CSS statiche**

Run: `pnpm build`
Expected: build passa senza errori (CSS puro, nessun impatto TypeScript).

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "feat: aggiungi CSS vars per i nuovi colori palette (base+varianti)"
```

---

### Task 3: Mappe di rendering colore (avatar, dot, chart)

**Files:**
- Modify: `components/domain/shared/color-swatches.ts`

**Interfaces:**
- Consumes: `SwatchColor` (Task 1), CSS vars `--swatch-*` (Task 2).
- Produces: `COLOR_SWATCH_MAP`, `COLOR_DOT`, `SWATCH_CHART_COLOR` con chiave `Record<SwatchColor, ...>` (48 entries), consumati da `CategoryAvatar`/`AccountAvatar` (Task 6) e dai picker (Task 4).

- [ ] **Step 1: Riscrivi `components/domain/shared/color-swatches.ts`**

```ts
/**
 * Mappa colore -> classi Tailwind (avatar bg/fg, dot pieno) condivisa da conti e categorie.
 * Copre i 16 colori base e le 32 varianti chiare/scure derivate (usate solo dalla
 * distribuzione automatica dei colori, non selezionabili manualmente nei picker).
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

/** Mappa colore -> CSS var per la torta multilivello (recharts richiede un valore letterale, non una classe Tailwind). */
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

- [ ] **Step 2: Verifica il typecheck**

Run: `pnpm build`
Expected: passa senza errori TypeScript (nessuna chiave `SwatchColor` mancante nei tre `Record`).

- [ ] **Step 3: Commit**

```bash
git add components/domain/shared/color-swatches.ts
git commit -m "feat: estendi mappe rendering colore (avatar/dot/chart) a 48 valori"
```

---

### Task 4: Picker manuale — solo i 16 colori base

**Files:**
- Modify: `components/domain/categories/category-icon-color-picker.tsx:11,31`
- Modify: `components/domain/accounts/account-icon-color-picker.tsx:8,36`

**Interfaces:**
- Consumes: `SWATCH_BASE_COLORS` (Task 1).
- Produces: nessuna nuova interfaccia pubblica — comportamento visivo dei picker esistenti invariato nella forma (griglia colori), solo la fonte dati cambia da 8/48 a 16.

- [ ] **Step 1: `category-icon-color-picker.tsx` — importa e usa `SWATCH_BASE_COLORS`**

In `components/domain/categories/category-icon-color-picker.tsx:11`, sostituisci:
```ts
import { SWATCH_COLORS } from "@/lib/validation/shared-colors";
```
con:
```ts
import { SWATCH_BASE_COLORS } from "@/lib/validation/shared-colors";
```

Alla riga 31, sostituisci `{SWATCH_COLORS.map((color) => (` con `{SWATCH_BASE_COLORS.map((color) => (`.

- [ ] **Step 2: `account-icon-color-picker.tsx` — introduci lo stesso filtro**

`ACCOUNT_COLORS` (in `lib/validation/accounts.ts:12`) resta `= SWATCH_COLORS` (48, usato per la validazione Zod — corretto, non toccare). Per il picker, in `components/domain/accounts/account-icon-color-picker.tsx:8`, aggiungi l'import di `SWATCH_BASE_COLORS` accanto a quello esistente:

```ts
import { ACCOUNT_ICONS } from "@/lib/validation/accounts";
import { SWATCH_BASE_COLORS } from "@/lib/validation/shared-colors";
```

(rimuovi `ACCOUNT_COLORS` dall'import esistente, non serve più in questo file). Alla riga 36, sostituisci `{ACCOUNT_COLORS.map((color) => (` con `{SWATCH_BASE_COLORS.map((color) => (`.

- [ ] **Step 3: Verifica il typecheck**

Run: `pnpm build`
Expected: passa senza errori (`color` nei due picker resta tipizzato `SwatchColor`, sottoinsieme valido).

- [ ] **Step 4: Commit**

```bash
git add components/domain/categories/category-icon-color-picker.tsx components/domain/accounts/account-icon-color-picker.tsx
git commit -m "feat: limita i picker manuali ai 16 colori base"
```

---

### Task 5: Icone categoria estese (28 → 60)

**Files:**
- Modify: `lib/validation/categories.ts:7-13`
- Modify: `lib/validation/categories.test.ts:4-7`
- Modify: `components/domain/categories/category-avatar.tsx:4-44`

**Interfaces:**
- Produces: `CATEGORY_ICONS` (60 elementi), `ICON_MAP: Record<CategoryIcon, LucideIcon>` (60 entries), consumati dal picker (invariato, itera già su `CATEGORY_ICONS`) e da `CategoryAvatar`.

- [ ] **Step 1: Aggiorna il test di lunghezza in `lib/validation/categories.test.ts:4-7`**

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

- [ ] **Step 2: Esegui il test, verifica che fallisca**

Run: `pnpm test -- categories.test.ts`
Expected: FAIL — `CATEGORY_ICONS` ha ancora 28 elementi.

- [ ] **Step 3: Estendi `CATEGORY_ICONS` in `lib/validation/categories.ts:7-13`**

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

- [ ] **Step 4: Aggiungi le 32 nuove icone a `ICON_MAP` in `components/domain/categories/category-avatar.tsx`**

Sostituisci il blocco import (righe 4-9) con:

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

Sostituisci il blocco `ICON_MAP` (righe 15-44) con:

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

- [ ] **Step 5: Esegui i test e il typecheck**

Run: `pnpm test -- categories.test.ts && pnpm build`
Expected: PASS — test icone verde, build passa (conferma che tutti i nomi Lucide importati esistono davvero in `lucide-react`; se un nome non esiste, `pnpm build` fallisce con errore di import e va corretto con il nome esatto del pacchetto installato).

- [ ] **Step 6: Commit**

```bash
git add lib/validation/categories.ts lib/validation/categories.test.ts components/domain/categories/category-avatar.tsx
git commit -m "feat: espandi icone categoria da 28 a 60"
```

---

### Task 6: Funzione pura di distribuzione colori

**Files:**
- Create: `lib/calc/distribute-colors.ts`
- Create: `lib/calc/distribute-colors.test.ts`

**Interfaces:**
- Consumes: `SWATCH_COLORS` (Task 1).
- Produces: `distributeColors(categoryIds: string[]): Record<string, SwatchColor>`, consumata dall'endpoint nel Task 7.

- [ ] **Step 1: Scrivi il test che fallisce**

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

- [ ] **Step 2: Esegui il test, verifica che fallisca**

Run: `pnpm test -- distribute-colors.test.ts`
Expected: FAIL con "Cannot find module './distribute-colors'"

- [ ] **Step 3: Implementa `lib/calc/distribute-colors.ts`**

```ts
import { SWATCH_COLORS } from "@/lib/validation/shared-colors";
import type { SwatchColor } from "@/lib/validation/shared-colors";

/**
 * Assegna un colore a ciascun id categoria (nell'ordine passato, tipicamente createdAt asc)
 * pescando dal pool di 48 colori senza ripetizioni finché possibile. Oltre i 48 elementi il
 * pool si ripete ciclicamente, ma non assegna mai lo stesso colore a due elementi adiacenti.
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

- [ ] **Step 4: Esegui il test, verifica che passi**

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
- Produces: `POST` handler che ritorna `200` con `Category[]` aggiornate (colori nuovi), consumato dalla mutation nel Task 8.

- [ ] **Step 1: Scrivi il test di integrazione che fallisce**

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

- [ ] **Step 2: Esegui il test, verifica che fallisca**

Run: `pnpm test -- app/api/categories/distribute-colors/route.test.ts`
Expected: FAIL — `./route` non esiste. (Nota: richiede Postgres locale raggiungibile, come gli altri test di route esistenti — se non disponibile in questo ambiente, procedi comunque con l'implementazione e segnala che la verifica va fatta dall'utente in locale, come da convenzione già stabilita nel progetto.)

- [ ] **Step 3: Implementa `app/api/categories/distribute-colors/route.ts`**

```ts
import { NextRequest } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { categories } from "@/lib/db/schema/categories";
import { distributeColors } from "@/lib/calc/distribute-colors";

/**
 * POST /api/categories/distribute-colors — riassegna un colore univoco (dal pool di 48)
 * a ogni categoria non-fallback dell'utente, in ordine di creazione; la categoria fallback
 * ("Da categorizzare") non viene mai toccata. Applica tutti gli update in un'unica
 * transazione: se qualcosa fallisce, nessuna categoria viene modificata.
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

- [ ] **Step 4: Esegui il test, verifica che passi (se DB disponibile)**

Run: `pnpm test -- app/api/categories/distribute-colors/route.test.ts`
Expected: PASS (in un ambiente con Postgres locale raggiungibile — stesso vincolo degli altri test di route in questo repo).

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

- [ ] **Step 1: Aggiungi la mutation in fondo a `lib/queries/categories.ts`**

```ts
/** Ridistribuisce automaticamente i colori delle categorie non-fallback ed invalida la lista al successo. */
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

- [ ] **Step 2: Verifica il typecheck**

Run: `pnpm build`
Expected: passa senza errori.

- [ ] **Step 3: Commit**

```bash
git add lib/queries/categories.ts
git commit -m "feat: aggiungi useDistributeColorsMutation"
```

---

### Task 9: Componente "Distribuisci colori" + integrazione pagina

**Files:**
- Create: `components/domain/categories/distribute-colors-button.tsx`
- Modify: `components/domain/categories/index.ts`
- Modify: `app/(app)/categorie/page.tsx:1-28`

**Interfaces:**
- Consumes: `useDistributeColorsMutation` (Task 8), `AlertDialog*` (`@/components/ui/alert-dialog`).
- Produces: `DistributeColorsButton` (nessuna prop, componente autonomo), esportato dal barrel `components/domain/categories`.

- [ ] **Step 1: Crea `components/domain/categories/distribute-colors-button.tsx`**

```tsx
"use client";

/** Pulsante con conferma che riassegna un colore univoco a ogni categoria non-fallback. */

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

- [ ] **Step 2: Esporta dal barrel `components/domain/categories/index.ts`**

Aggiungi in fondo al file:

```ts
export { DistributeColorsButton } from "./distribute-colors-button";
```

- [ ] **Step 3: Integra il pulsante nell'header di `app/(app)/categorie/page.tsx`**

Aggiorna l'import (riga 5):

```ts
import { AddCategoryForm, CategoryRow, DistributeColorsButton } from "@/components/domain/categories";
```

Nel blocco header (righe 15-28), aggiungi il pulsante prima del link "Torna a Spese":

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

- [ ] **Step 4: Verifica il typecheck e il lint**

Run: `pnpm build && pnpm lint`
Expected: entrambi passano senza errori.

- [ ] **Step 5: Commit**

```bash
git add components/domain/categories/distribute-colors-button.tsx components/domain/categories/index.ts "app/(app)/categorie/page.tsx"
git commit -m "feat: aggiungi pulsante Distribuisci colori nella pagina Categorie"
```

---

## Verifica finale (whole-branch)

Dopo l'ultimo task:

```bash
pnpm build
pnpm lint
pnpm test
```

Verifica manuale utente (nessun Postgres/Redis nel sandbox agentico, come da nota già presente in CLAUDE.md per le feature precedenti su categorie): aprire `/categorie`, controllare che il picker mostri 16 pallini colore, creare/rinominare/ricolorare una categoria, poi cliccare "Distribuisci colori" con più categorie esistenti e verificare che i colori risultino tutti diversi tra loro e che "Da categorizzare" resti rossa.
