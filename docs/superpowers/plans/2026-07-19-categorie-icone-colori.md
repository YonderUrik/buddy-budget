# Categorie: icone/colori + gestione completa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere icona/colore personalizzabili e gestione completa (crea/rinomina/elimina) alle categorie di spesa, con una pagina dedicata `/categorie` fuori sidebar.

**Architecture:** Estensione dello schema `categories` (nuove colonne `text` `color`/`icon` + `boolean isFallback`, stesso pattern già usato in `accounts`), nuove route API `POST /api/categories` e `app/api/categories/[id]/route.ts` (PATCH/DELETE con ownership check e riassegnazione alla categoria fallback in cascata), nuovi componenti in `components/domain/categories/` che ricalcano 1:1 `components/domain/accounts/` (avatar, picker, row, form), estrazione della mappa colori condivisa (`components/domain/shared/color-swatches.ts`) per non duplicarla tra conti e categorie.

**Tech Stack:** Next.js App Router, Drizzle ORM (Postgres), Zod, TanStack Query, `@base-ui/react` (Select/Popover/AlertDialog), lucide-react, Vitest.

## Global Constraints

- Niente colori esadecimali o hardcoded nei componenti: usa sempre classi Tailwind sui token/swatch condivisi (nessuna nuova stringa colore fuori da `color-swatches.ts`).
- `categories.color`/`categories.icon` sono colonne `text` con default (NON `pgEnum`), stesso pattern di `accounts.color`/`accounts.icon` — validazione solo a livello Zod (`z.enum(...)`).
- Ogni componente pubblico ha JSDoc minimo (una riga) e props esplicite; barrel file (`index.ts`) per ogni cartella nuova.
- Ownership check su ogni route che legge/scrive una risorsa per id (`and(eq(id), eq(userId, session.user.id))`), 404 se non propria — mai 403/altro, per non rivelare l'esistenza di risorse altrui (pattern IDOR-safe già in uso in `app/api/accounts/[id]/route.ts` e `app/api/budgets/[categoryId]/route.ts`).
- Modifiche allo schema si applicano con `pnpm db:push` (non esiste una migration SQL versionata per singola feature dopo la baseline `0000_silly_flatman.sql` — le modifiche incrementali successive, es. `budgets`, `excludedAmount`, sono state applicate così).
- Testo utente sempre in italiano (i18n non ancora implementata).
- Nessun comando git: mai eseguirlo in nessuna forma, nemmeno "dry-run" (regola di repository).

---

### Task 1: Estrazione palette colori condivisa (conti + categorie)

**Files:**
- Create: `lib/validation/shared-colors.ts`
- Create: `components/domain/shared/color-swatches.ts`
- Modify: `lib/validation/accounts.ts`
- Modify: `components/domain/accounts/account-avatar.tsx`
- Modify: `components/domain/accounts/account-icon-color-picker.tsx`
- Test: `lib/validation/shared-colors.test.ts`

**Interfaces:**
- Produces: `SWATCH_COLORS: readonly ["slate","blue","green","yellow","purple","orange","red","teal"]`, `type SwatchColor` (da `lib/validation/shared-colors.ts`); `COLOR_SWATCH_MAP: Record<SwatchColor, { bg: string; fg: string }>`, `COLOR_DOT: Record<SwatchColor, string>` (da `components/domain/shared/color-swatches.ts`).
- Consumes: nessuno (base per tutti i task successivi che toccano colori).

- [ ] **Step 1: Scrivi il test che verifica l'elenco colori condiviso**

```ts
// lib/validation/shared-colors.test.ts
import { describe, expect, it } from "vitest";
import { SWATCH_COLORS } from "./shared-colors";
import { ACCOUNT_COLORS } from "./accounts";
import { CATEGORY_COLORS } from "./categories";

describe("SWATCH_COLORS", () => {
  it("ha 8 colori", () => {
    expect(SWATCH_COLORS).toHaveLength(8);
  });

  it("ACCOUNT_COLORS e CATEGORY_COLORS puntano alla stessa palette condivisa", () => {
    expect(ACCOUNT_COLORS).toEqual(SWATCH_COLORS);
    expect(CATEGORY_COLORS).toEqual(SWATCH_COLORS);
  });
});
```

- [ ] **Step 2: Esegui il test, verifica che fallisca**

Run: `pnpm test lib/validation/shared-colors.test.ts`
Expected: FAIL — `shared-colors` e `categories` non esistono ancora.

- [ ] **Step 3: Crea `lib/validation/shared-colors.ts`**

```ts
// lib/validation/shared-colors.ts

/** Palette di 8 colori condivisa da conti e categorie, per coerenza visiva tra le due entità. */
export const SWATCH_COLORS = [
  "slate", "blue", "green", "yellow", "purple", "orange", "red", "teal",
] as const;
export type SwatchColor = (typeof SWATCH_COLORS)[number];
```

- [ ] **Step 4: Aggiorna `lib/validation/accounts.ts` per riusare `SWATCH_COLORS`**

Sostituisci le righe 11-14 (definizione locale di `ACCOUNT_COLORS`/`AccountColor`):

```ts
import { SWATCH_COLORS, type SwatchColor } from "./shared-colors";

export const ACCOUNT_COLORS = SWATCH_COLORS;
export type AccountColor = SwatchColor;
```

Aggiungi l'import in cima al file insieme a `import { z } from "zod";` già presente.

- [ ] **Step 5: Crea `lib/validation/categories.ts` (solo la parte colori per ora — icone e schemi arrivano nel Task 2)**

```ts
// lib/validation/categories.ts
import { SWATCH_COLORS, type SwatchColor } from "./shared-colors";

export const CATEGORY_COLORS = SWATCH_COLORS;
export type CategoryColor = SwatchColor;
```

- [ ] **Step 6: Esegui il test, verifica che passi**

Run: `pnpm test lib/validation/shared-colors.test.ts`
Expected: PASS

- [ ] **Step 7: Crea `components/domain/shared/color-swatches.ts`**

```ts
// components/domain/shared/color-swatches.ts

/**
 * Mappa colore -> classi Tailwind (avatar bg/fg, dot pieno) condivisa da conti e categorie.
 * Estratta da account-avatar.tsx/account-icon-color-picker.tsx per non duplicarla.
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
};
```

- [ ] **Step 8: Aggiorna `account-avatar.tsx` per usare `COLOR_SWATCH_MAP`**

Rimuovi la definizione locale `COLOR_MAP` (righe 73-106) e l'import ora inutilizzato di `AccountColor` se non serve più direttamente (resta comunque usato come tipo prop, quindi l'import resta). Sostituisci con:

```ts
import { COLOR_SWATCH_MAP } from "@/components/domain/shared/color-swatches";
```

E nel corpo di `AccountAvatar`, sostituisci:

```ts
const { bg, fg } = COLOR_MAP[color] ?? COLOR_MAP.slate;
```

con:

```ts
const { bg, fg } = COLOR_SWATCH_MAP[color] ?? COLOR_SWATCH_MAP.slate;
```

- [ ] **Step 9: Aggiorna `account-icon-color-picker.tsx` per usare `COLOR_DOT`**

Rimuovi la costante locale `COLOR_DOT` (righe 12-21) e aggiungi:

```ts
import { COLOR_DOT } from "@/components/domain/shared/color-swatches";
```

Il resto del file (uso di `COLOR_DOT[color]` nel bottone swatch) resta identico.

- [ ] **Step 10: Verifica che il progetto compili e i test esistenti passino**

Run: `pnpm test`
Expected: PASS (nessuna regressione su test esistenti di conti/budget/transazioni).

- [ ] **Step 11: Commit**

```bash
git add lib/validation/shared-colors.ts lib/validation/shared-colors.test.ts lib/validation/accounts.ts lib/validation/categories.ts components/domain/shared/color-swatches.ts components/domain/accounts/account-avatar.tsx components/domain/accounts/account-icon-color-picker.tsx
git commit -m "refactor: estrae palette colori condivisa tra conti e categorie"
```

---

### Task 2: Palette icone dedicata e schemi Zod per le categorie

**Files:**
- Modify: `lib/validation/categories.ts`
- Test: `lib/validation/categories.test.ts`

**Interfaces:**
- Consumes: `CATEGORY_COLORS`, `CategoryColor` da `lib/validation/categories.ts` (Task 1).
- Produces: `CATEGORY_ICONS: readonly string[]` (28 valori), `type CategoryIcon`; `createCategorySchema`, `type CreateCategoryInput`; `updateCategorySchema`, `type UpdateCategoryInput`.

- [ ] **Step 1: Scrivi i test per gli schemi**

```ts
// lib/validation/categories.test.ts
import { describe, expect, it } from "vitest";
import { CATEGORY_COLORS, CATEGORY_ICONS, createCategorySchema, updateCategorySchema } from "./categories";

describe("CATEGORY_ICONS", () => {
  it("ha 28 icone", () => {
    expect(CATEGORY_ICONS).toHaveLength(28);
  });

  it("non ha duplicati", () => {
    expect(new Set(CATEGORY_ICONS).size).toBe(CATEGORY_ICONS.length);
  });
});

describe("createCategorySchema", () => {
  it("accetta nome/tipo validi senza icona/colore (opzionali)", () => {
    const result = createCategorySchema.safeParse({ name: "Palestra", type: "variabile" });
    expect(result.success).toBe(true);
  });

  it("accetta icona/colore validi", () => {
    const result = createCategorySchema.safeParse({
      name: "Palestra",
      type: "variabile",
      icon: "dumbbell",
      color: "teal",
    });
    expect(result.success).toBe(true);
  });

  it("rifiuta nome vuoto", () => {
    const result = createCategorySchema.safeParse({ name: "  ", type: "variabile" });
    expect(result.success).toBe(false);
  });

  it("rifiuta un tipo non valido", () => {
    const result = createCategorySchema.safeParse({ name: "Palestra", type: "annuale" });
    expect(result.success).toBe(false);
  });

  it("rifiuta un'icona fuori enum", () => {
    const result = createCategorySchema.safeParse({ name: "Palestra", type: "variabile", icon: "bitcoin" });
    expect(result.success).toBe(false);
  });

  it("rifiuta un colore fuori enum", () => {
    const result = createCategorySchema.safeParse({ name: "Palestra", type: "variabile", color: "pink" });
    expect(result.success).toBe(false);
  });
});

describe("updateCategorySchema", () => {
  it("rifiuta un body vuoto", () => {
    const result = updateCategorySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accetta un solo campo (rename)", () => {
    const result = updateCategorySchema.safeParse({ name: "Nuovo nome" });
    expect(result.success).toBe(true);
  });
});

describe("CATEGORY_COLORS", () => {
  it("ha 8 colori (stessa palette dei conti)", () => {
    expect(CATEGORY_COLORS).toHaveLength(8);
  });
});
```

- [ ] **Step 2: Esegui i test, verifica che falliscano**

Run: `pnpm test lib/validation/categories.test.ts`
Expected: FAIL — `CATEGORY_ICONS`, `createCategorySchema`, `updateCategorySchema` non esistono ancora.

- [ ] **Step 3: Estendi `lib/validation/categories.ts`**

```ts
// lib/validation/categories.ts
import { z } from "zod";
import { SWATCH_COLORS, type SwatchColor } from "./shared-colors";

export const CATEGORY_COLORS = SWATCH_COLORS;
export type CategoryColor = SwatchColor;

export const CATEGORY_ICONS = [
  "utensils", "shopping-cart", "home", "zap", "droplet", "wifi", "tv",
  "smartphone", "car", "bus", "plane", "fuel", "film", "gamepad-2",
  "music", "heart", "stethoscope", "dumbbell", "graduation-cap", "baby",
  "paw-print", "shirt", "scissors", "gift", "briefcase", "wrench",
  "package", "help-circle",
] as const;
export type CategoryIcon = (typeof CATEGORY_ICONS)[number];

export const createCategorySchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(["fissa", "variabile"]),
  color: z.enum(CATEGORY_COLORS).optional(),
  icon: z.enum(CATEGORY_ICONS).optional(),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    type: z.enum(["fissa", "variabile"]).optional(),
    color: z.enum(CATEGORY_COLORS).optional(),
    icon: z.enum(CATEGORY_ICONS).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Nessun campo da aggiornare",
  });
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
```

- [ ] **Step 4: Esegui i test, verifica che passino**

Run: `pnpm test lib/validation/categories.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/validation/categories.ts lib/validation/categories.test.ts
git commit -m "feat: aggiunge palette icone e schemi di validazione per le categorie"
```

---

### Task 3: Schema DB (color/icon/isFallback), seed e backfill

**Files:**
- Modify: `lib/db/schema/categories.ts`
- Modify: `lib/auth/index.ts`
- Modify: `lib/db/seed.ts`
- Create: `lib/db/backfill-category-appearance.ts`
- Test: `lib/db/schema/categories.test.ts`

**Interfaces:**
- Consumes: `CategoryIcon`, `CategoryColor` da `lib/validation/categories.ts` (Task 2).
- Produces: `categories.color: string`, `categories.icon: string`, `categories.isFallback: boolean` (nuove colonne); `DEFAULT_CATEGORIES: { name: string; type: "fissa" | "variabile"; icon: CategoryIcon; color: CategoryColor; isFallback?: boolean }[]` (tipo esteso, stesso export esistente).

- [ ] **Step 1: Scrivi il test sulla completezza di `DEFAULT_CATEGORIES`**

```ts
// lib/db/schema/categories.test.ts
import { describe, expect, it } from "vitest";
import { CATEGORY_COLORS, CATEGORY_ICONS } from "@/lib/validation/categories";
import { DEFAULT_CATEGORIES } from "./categories";

describe("DEFAULT_CATEGORIES", () => {
  it("ha 9 categorie", () => {
    expect(DEFAULT_CATEGORIES).toHaveLength(9);
  });

  it("ogni categoria ha icona e colore validi", () => {
    for (const category of DEFAULT_CATEGORIES) {
      expect(CATEGORY_ICONS).toContain(category.icon);
      expect(CATEGORY_COLORS).toContain(category.color);
    }
  });

  it("solo 'Da categorizzare' è isFallback", () => {
    const fallbackEntries = DEFAULT_CATEGORIES.filter((c) => c.isFallback === true);
    expect(fallbackEntries).toHaveLength(1);
    expect(fallbackEntries[0].name).toBe("Da categorizzare");
  });
});
```

- [ ] **Step 2: Esegui il test, verifica che fallisca**

Run: `pnpm test lib/db/schema/categories.test.ts`
Expected: FAIL — `category.icon`/`category.color`/`category.isFallback` sono `undefined`, gli `expect(...).toContain(undefined)` falliscono.

- [ ] **Step 3: Aggiorna `lib/db/schema/categories.ts`**

Sostituisci l'intero file:

```ts
import { boolean, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { authUser } from "./auth";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";

export const categoryTypeEnum = pgEnum("category_type", ["fissa", "variabile"]);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: categoryTypeEnum("type").notNull(),
    color: text("color").notNull().default("slate"),
    icon: text("icon").notNull().default("package"),
    isFallback: boolean("is_fallback").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("categories_user_name_unique").on(table.userId, table.name)]
);

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export const DEFAULT_CATEGORIES: {
  name: string;
  type: "fissa" | "variabile";
  icon: CategoryIcon;
  color: CategoryColor;
  isFallback?: boolean;
}[] = [
  { name: "Affitto", type: "fissa", icon: "home", color: "slate" },
  { name: "Bollette & casa", type: "fissa", icon: "zap", color: "yellow" },
  { name: "Abbonamenti", type: "fissa", icon: "tv", color: "purple" },
  { name: "Spesa alimentare", type: "variabile", icon: "shopping-cart", color: "green" },
  { name: "Ristoranti", type: "variabile", icon: "utensils", color: "orange" },
  { name: "Altro", type: "variabile", icon: "package", color: "slate" },
  { name: "Svago", type: "variabile", icon: "film", color: "teal" },
  { name: "Trasporti", type: "variabile", icon: "car", color: "blue" },
  { name: "Da categorizzare", type: "variabile", icon: "help-circle", color: "red", isFallback: true },
];
```

- [ ] **Step 4: Esegui il test, verifica che passi**

Run: `pnpm test lib/db/schema/categories.test.ts`
Expected: PASS

- [ ] **Step 5: Aggiorna il seed hook in `lib/auth/index.ts`**

Sostituisci il blocco `after` (righe 65-72):

```ts
after: async (user) => {
  await db.insert(categories).values(
    DEFAULT_CATEGORIES.map((cat) => ({
      userId: user.id,
      name: cat.name,
      type: cat.type,
      color: cat.color,
      icon: cat.icon,
      isFallback: cat.isFallback ?? false,
    }))
  );
},
```

- [ ] **Step 6: Aggiorna `lib/db/seed.ts`**

Sostituisci il blocco `.values(...)` (righe 27-31):

```ts
.values(
  DEFAULT_CATEGORIES.map((category) => ({
    userId: user.id,
    name: category.name,
    type: category.type,
    color: category.color,
    icon: category.icon,
    isFallback: category.isFallback ?? false,
  }))
)
```

- [ ] **Step 7: Applica lo schema al database**

Run: `pnpm db:push`
Expected: drizzle-kit segnala le nuove colonne (`color`, `icon`, `is_fallback`) e il vincolo unique su `categories`; conferma l'applicazione (prompt interattivo — rispondi "Yes" per applicare le modifiche additive).

- [ ] **Step 8: Crea lo script di backfill una-tantum per righe già esistenti**

```ts
// lib/db/backfill-category-appearance.ts

/**
 * Script una tantum: applica icona/colore/isFallback alle categorie create prima
 * di questa feature (che dopo `pnpm db:push` hanno preso i default generici
 * "package"/"slate"/false). Aggiorna per nome esatto contro DEFAULT_CATEGORIES;
 * lascia invariate le categorie che non corrispondono a nessun nome noto.
 * Esegui con: pnpm exec tsx --env-file=.env.local lib/db/backfill-category-appearance.ts
 */

import { and, eq } from "drizzle-orm";
import { client, db } from "./client";
import { categories, DEFAULT_CATEGORIES } from "./schema/categories";

async function main() {
  let updated = 0;
  for (const category of DEFAULT_CATEGORIES) {
    const result = await db
      .update(categories)
      .set({
        icon: category.icon,
        color: category.color,
        isFallback: category.isFallback ?? false,
      })
      .where(and(eq(categories.name, category.name), eq(categories.type, category.type)))
      .returning();
    updated += result.length;
  }
  console.log(`Categorie aggiornate: ${updated}`);
  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 9: Esegui il backfill contro il database di sviluppo**

Run: `pnpm exec tsx --env-file=.env.local lib/db/backfill-category-appearance.ts`
Expected: stampa `Categorie aggiornate: N` (N = numero di righe che matchano un nome di `DEFAULT_CATEGORIES`, 0 se il DB ha solo utenti creati dopo questo deploy).

- [ ] **Step 10: Esegui l'intera suite di test**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add lib/db/schema/categories.ts lib/db/schema/categories.test.ts lib/auth/index.ts lib/db/seed.ts lib/db/backfill-category-appearance.ts
git commit -m "feat: aggiunge color/icon/isFallback allo schema categorie, seed e backfill"
```

---

### Task 4: Componenti avatar e picker per le categorie

**Files:**
- Create: `components/domain/categories/category-avatar.tsx`
- Create: `components/domain/categories/category-icon-color-picker.tsx`
- Create: `components/domain/categories/index.ts`

**Interfaces:**
- Consumes: `CATEGORY_ICONS`, `CategoryIcon`, `CategoryColor` (Task 2); `COLOR_SWATCH_MAP`, `COLOR_DOT` (Task 1).
- Produces: `CategoryAvatar({ color, icon, size?, className? })`, `CategoryIconColorPicker({ value, onChange, children })` — stessa firma di `AccountAvatar`/`AccountIconColorPicker`, riusate nei Task 7-8.

- [ ] **Step 1: Crea `category-avatar.tsx`**

```tsx
/** Avatar categoria: icona Lucide su cerchio colorato (stessa palette colori dei conti, icone dedicate alle spese). */

import * as React from "react";
import {
  Utensils, ShoppingCart, Home, Zap, Droplet, Wifi, Tv, Smartphone,
  Car, Bus, Plane, Fuel, Film, Gamepad2, Music, Heart, Stethoscope,
  Dumbbell, GraduationCap, Baby, PawPrint, Shirt, Scissors, Gift,
  Briefcase, Wrench, Package, HelpCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { COLOR_SWATCH_MAP } from "@/components/domain/shared/color-swatches";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";

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
};

export interface CategoryAvatarProps {
  color: CategoryColor;
  icon: CategoryIcon;
  size?: number;
  className?: string;
}

export function CategoryAvatar({ color, icon, size = 16, className }: CategoryAvatarProps) {
  const Icon = ICON_MAP[icon] ?? Package;
  const { bg, fg } = COLOR_SWATCH_MAP[color] ?? COLOR_SWATCH_MAP.slate;

  return (
    <div
      className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", bg, className)}
      aria-hidden="true"
    >
      <Icon size={size} className={fg} />
    </div>
  );
}
```

- [ ] **Step 2: Crea `category-icon-color-picker.tsx`**

```tsx
"use client";

/** Popover per scegliere colore e icona di una categoria. Click sull'avatar apre il picker. */

import * as React from "react";
import { Popover } from "@base-ui/react/popover";
import { cn } from "@/lib/utils";
import { COLOR_DOT } from "@/components/domain/shared/color-swatches";
import { CATEGORY_ICONS } from "@/lib/validation/categories";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
import { SWATCH_COLORS } from "@/lib/validation/shared-colors";
import { ICON_MAP } from "./category-avatar";

export interface CategoryIconColorPickerProps {
  value: { color: CategoryColor; icon: CategoryIcon };
  onChange: (value: { color: CategoryColor; icon: CategoryIcon }) => void;
  children: React.ReactNode;
}

export function CategoryIconColorPicker({ value, onChange, children }: CategoryIconColorPickerProps) {
  return (
    <Popover.Root>
      <Popover.Trigger className="cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        {children}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} className="z-[60]">
          <Popover.Popup className="z-[60] w-64 rounded-xl border border-border bg-popover p-3 shadow-lg outline-none">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Colore</p>
            <div className="mb-4 flex gap-1.5">
              {SWATCH_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => onChange({ ...value, color })}
                  className={cn(
                    "size-6 rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    COLOR_DOT[color],
                    value.color === color &&
                      "ring-2 ring-foreground ring-offset-2 ring-offset-popover"
                  )}
                  aria-label={color}
                  aria-pressed={value.color === color}
                />
              ))}
            </div>

            <p className="mb-2 text-xs font-medium text-muted-foreground">Icona</p>
            <div className="grid grid-cols-7 gap-1">
              {CATEGORY_ICONS.map((icon) => {
                const Icon = ICON_MAP[icon];
                return (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => onChange({ ...value, icon })}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      value.icon === icon && "bg-accent text-accent-foreground"
                    )}
                    aria-label={icon}
                    aria-pressed={value.icon === icon}
                  >
                    <Icon size={16} />
                  </button>
                );
              })}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
```

- [ ] **Step 3: Crea il barrel `components/domain/categories/index.ts`**

```ts
/**
 * components/domain/categories — barrel file
 *
 * Punto di ingresso unico per i componenti di gestione categorie.
 */

export { CategoryAvatar } from "./category-avatar";
export type { CategoryAvatarProps } from "./category-avatar";
export { CategoryIconColorPicker } from "./category-icon-color-picker";
export type { CategoryIconColorPickerProps } from "./category-icon-color-picker";
```

- [ ] **Step 4: Verifica che il progetto compili**

Run: `pnpm lint`
Expected: nessun errore (nessun import inutilizzato, nessuna icona mancante nel `ICON_MAP` rispetto a `CATEGORY_ICONS` — TypeScript fallirebbe la compilazione se `Record<CategoryIcon, LucideIcon>` fosse incompleto).

- [ ] **Step 5: Commit**

```bash
git add components/domain/categories/category-avatar.tsx components/domain/categories/category-icon-color-picker.tsx components/domain/categories/index.ts
git commit -m "feat: aggiunge avatar e picker icona/colore per le categorie"
```

---

### Task 5: API — creare, aggiornare, eliminare categorie

**Files:**
- Modify: `app/api/categories/route.ts`
- Modify: `app/api/categories/route.test.ts`
- Create: `app/api/categories/[id]/route.ts`
- Create: `app/api/categories/[id]/route.test.ts`

**Interfaces:**
- Consumes: `createCategorySchema`, `updateCategorySchema` (Task 2); `categories`, `Category` da `lib/db/schema/categories.ts` (Task 3); `budgets` da `lib/db/schema/budgets.ts`; `transactions` da `lib/db/schema/transactions.ts`.
- Produces: `POST /api/categories` (201, body `Category`); `PATCH /api/categories/[id]` (200, body `Category` aggiornata, 404 se non propria, 409 se nome duplicato); `DELETE /api/categories/[id]` (204, 404 se non propria, 409 se `isFallback`).

- [ ] **Step 1: Scrivi i test per `POST /api/categories`**

Aggiungi in fondo a `app/api/categories/route.test.ts` (prima della chiusura del `describe` esistente, come nuovo blocco `describe`):

```ts
import { POST } from "./route";

describe("POST /api/categories", () => {
  let userId: string;

  beforeEach(async () => {
    const testId = `test-categories-post-${crypto.randomUUID()}`;
    const [user] = await db
      .insert(authUser)
      .values({
        id: testId,
        name: "Test User",
        email: `test-categories-post-${Date.now()}@example.com`,
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

  it("crea una categoria con icona/colore di default se omessi", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/categories", {
        method: "POST",
        body: JSON.stringify({ name: "Palestra", type: "variabile" }),
      })
    );
    expect(response.status).toBe(201);
    const created = await response.json();
    expect(created.name).toBe("Palestra");
    expect(created.color).toBe("slate");
    expect(created.icon).toBe("package");
  });

  it("crea una categoria con icona/colore espliciti", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/categories", {
        method: "POST",
        body: JSON.stringify({ name: "Palestra", type: "variabile", icon: "dumbbell", color: "teal" }),
      })
    );
    expect(response.status).toBe(201);
    const created = await response.json();
    expect(created.icon).toBe("dumbbell");
    expect(created.color).toBe("teal");
  });

  it("risponde 409 su un nome già usato dallo stesso utente", async () => {
    await db.insert(categories).values({ userId, name: "Palestra", type: "variabile" });

    const response = await POST(
      new NextRequest("http://localhost/api/categories", {
        method: "POST",
        body: JSON.stringify({ name: "Palestra", type: "variabile" }),
      })
    );
    expect(response.status).toBe(409);
  });

  it("risponde 400 su nome vuoto", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/categories", {
        method: "POST",
        body: JSON.stringify({ name: "  ", type: "variabile" }),
      })
    );
    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Esegui i test, verifica che falliscano**

Run: `pnpm test app/api/categories/route.test.ts`
Expected: FAIL — `POST` non è esportato da `./route`.

- [ ] **Step 3: Aggiungi `POST` a `app/api/categories/route.ts`**

Aggiungi in fondo al file (dopo `GET`):

```ts
import { and, eq } from "drizzle-orm";
import { createCategorySchema } from "@/lib/validation/categories";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }

  const body = await request.json();
  const parsed = createCategorySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.userId, session.user.id), eq(categories.name, parsed.data.name)));
  if (existing) {
    return Response.json({ error: "Categoria già esistente" }, { status: 409 });
  }

  const [category] = await db
    .insert(categories)
    .values({
      userId: session.user.id,
      name: parsed.data.name,
      type: parsed.data.type,
      ...(parsed.data.color ? { color: parsed.data.color } : {}),
      ...(parsed.data.icon ? { icon: parsed.data.icon } : {}),
    })
    .returning();

  return Response.json(category, { status: 201 });
}
```

Nota: l'import di `eq` già presente in cima al file va sostituito dall'import combinato `and, eq` (rimuovi la riga `import { asc, eq } from "drizzle-orm";` esistente e sostituiscila con `import { and, asc, eq } from "drizzle-orm";`, spostando il nuovo import di `createCategorySchema` in cima insieme agli altri invece che a metà file).

- [ ] **Step 4: Esegui i test, verifica che passino**

Run: `pnpm test app/api/categories/route.test.ts`
Expected: PASS

- [ ] **Step 5: Scrivi i test per `PATCH`/`DELETE /api/categories/[id]`**

```ts
// app/api/categories/[id]/route.test.ts
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { categories } from "@/lib/db/schema/categories";
import { budgets } from "@/lib/db/schema/budgets";
import { transactions } from "@/lib/db/schema/transactions";
import { accounts } from "@/lib/db/schema/accounts";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { PATCH, DELETE } from "./route";

const mockedGetSession = vi.mocked(auth.api.getSession);

describe("PATCH/DELETE /api/categories/[id]", () => {
  let userId: string;
  let otherUserId: string;
  let fallbackCategoryId: string;

  beforeEach(async () => {
    const testId = `test-category-id-${crypto.randomUUID()}`;
    const [user] = await db
      .insert(authUser)
      .values({
        id: testId,
        name: "Test User",
        email: `test-category-id-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    userId = user.id;

    const otherId = `test-category-id-other-${crypto.randomUUID()}`;
    const [otherUser] = await db
      .insert(authUser)
      .values({
        id: otherId,
        name: "Other User",
        email: `test-category-id-other-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    otherUserId = otherUser.id;

    const [fallback] = await db
      .insert(categories)
      .values({ userId, name: "Da categorizzare", type: "variabile", isFallback: true })
      .returning();
    fallbackCategoryId = fallback.id;

    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
    await db.delete(authUser).where(eq(authUser.id, otherUserId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("rinomina una categoria propria", async () => {
    const [category] = await db
      .insert(categories)
      .values({ userId, name: "Svago", type: "variabile" })
      .returning();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/categories/${category.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: "Tempo libero" }),
      }),
      { params: Promise.resolve({ id: category.id }) }
    );

    expect(response.status).toBe(200);
    const updated = await response.json();
    expect(updated.name).toBe("Tempo libero");
  });

  it("aggiorna icona/colore di una categoria propria", async () => {
    const [category] = await db
      .insert(categories)
      .values({ userId, name: "Svago", type: "variabile" })
      .returning();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/categories/${category.id}`, {
        method: "PATCH",
        body: JSON.stringify({ icon: "music", color: "purple" }),
      }),
      { params: Promise.resolve({ id: category.id }) }
    );

    expect(response.status).toBe(200);
    const updated = await response.json();
    expect(updated.icon).toBe("music");
    expect(updated.color).toBe("purple");
  });

  it("risponde 409 rinominando su un nome già usato dallo stesso utente", async () => {
    await db.insert(categories).values({ userId, name: "Trasporti", type: "variabile" });
    const [category] = await db
      .insert(categories)
      .values({ userId, name: "Svago", type: "variabile" })
      .returning();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/categories/${category.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: "Trasporti" }),
      }),
      { params: Promise.resolve({ id: category.id }) }
    );

    expect(response.status).toBe(409);
  });

  it("risponde 404 aggiornando una categoria di un altro utente", async () => {
    const [otherCategory] = await db
      .insert(categories)
      .values({ userId: otherUserId, name: "Categoria altrui", type: "variabile" })
      .returning();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/categories/${otherCategory.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: "Hackerata" }),
      }),
      { params: Promise.resolve({ id: otherCategory.id }) }
    );

    expect(response.status).toBe(404);
  });

  it("elimina una categoria senza transazioni collegate", async () => {
    const [category] = await db
      .insert(categories)
      .values({ userId, name: "Svago", type: "variabile" })
      .returning();

    const response = await DELETE(
      new NextRequest(`http://localhost/api/categories/${category.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: category.id }) }
    );

    expect(response.status).toBe(204);
    const remaining = await db.select().from(categories).where(eq(categories.id, category.id));
    expect(remaining).toHaveLength(0);
  });

  it("riassegna transazioni ed elimina il budget quando elimina una categoria in uso", async () => {
    const [account] = await db
      .insert(accounts)
      .values({ userId, name: "Conto", type: "Conto corrente", balance: "0" })
      .returning();
    const [category] = await db
      .insert(categories)
      .values({ userId, name: "Svago", type: "variabile" })
      .returning();
    await db.insert(budgets).values({ userId, categoryId: category.id, monthlyAmount: "100.00" });
    const [transaction] = await db
      .insert(transactions)
      .values({
        userId,
        accountId: account.id,
        categoryId: category.id,
        description: "Cinema",
        amount: "-15.00",
        date: "2026-07-01",
      })
      .returning();

    const response = await DELETE(
      new NextRequest(`http://localhost/api/categories/${category.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: category.id }) }
    );

    expect(response.status).toBe(204);

    const remainingBudgets = await db.select().from(budgets).where(eq(budgets.categoryId, category.id));
    expect(remainingBudgets).toHaveLength(0);

    const [reassigned] = await db.select().from(transactions).where(eq(transactions.id, transaction.id));
    expect(reassigned.categoryId).toBe(fallbackCategoryId);
  });

  it("risponde 409 eliminando la categoria fallback", async () => {
    const response = await DELETE(
      new NextRequest(`http://localhost/api/categories/${fallbackCategoryId}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: fallbackCategoryId }) }
    );

    expect(response.status).toBe(409);
    const remaining = await db.select().from(categories).where(eq(categories.id, fallbackCategoryId));
    expect(remaining).toHaveLength(1);
  });

  it("risponde 404 eliminando una categoria di un altro utente", async () => {
    const [otherCategory] = await db
      .insert(categories)
      .values({ userId: otherUserId, name: "Categoria altrui", type: "variabile" })
      .returning();

    const response = await DELETE(
      new NextRequest(`http://localhost/api/categories/${otherCategory.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: otherCategory.id }) }
    );

    expect(response.status).toBe(404);
  });
});
```

- [ ] **Step 6: Esegui i test, verifica che falliscano**

Run: `pnpm test app/api/categories/[id]/route.test.ts`
Expected: FAIL — `app/api/categories/[id]/route.ts` non esiste ancora.

- [ ] **Step 7: Crea `app/api/categories/[id]/route.ts`**

```ts
import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { categories } from "@/lib/db/schema/categories";
import { budgets } from "@/lib/db/schema/budgets";
import { transactions } from "@/lib/db/schema/transactions";
import { updateCategorySchema } from "@/lib/validation/categories";

/** Recupera una categoria solo se appartiene all'utente indicato, altrimenti null. */
async function getOwnedCategory(userId: string, categoryId: string) {
  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)));
  return category ?? null;
}

/** Recupera la categoria fallback ("Da categorizzare") del proprio utente. */
async function getFallbackCategory(userId: string) {
  const [fallback] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.isFallback, true)));
  return fallback ?? null;
}

/** Aggiorna nome/tipo/icona/colore di una categoria del proprio utente; 404 se non propria, 409 se nome duplicato. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }

  const { id } = await params;
  const category = await getOwnedCategory(session.user.id, id);
  if (!category) {
    return new Response(null, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateCategorySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  if (parsed.data.name && parsed.data.name !== category.name) {
    const [existing] = await db
      .select()
      .from(categories)
      .where(and(eq(categories.userId, session.user.id), eq(categories.name, parsed.data.name)));
    if (existing) {
      return Response.json({ error: "Categoria già esistente" }, { status: 409 });
    }
  }

  const [updated] = await db
    .update(categories)
    .set(parsed.data)
    .where(eq(categories.id, id))
    .returning();

  return Response.json(updated);
}

/**
 * Elimina una categoria del proprio utente; 404 se non propria, 409 se è la
 * categoria fallback. Le transazioni collegate vengono riassegnate alla
 * categoria fallback ("Da categorizzare") e il budget collegato eliminato,
 * nella stessa transazione DB della cancellazione.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }

  const { id } = await params;
  const category = await getOwnedCategory(session.user.id, id);
  if (!category) {
    return new Response(null, { status: 404 });
  }

  if (category.isFallback) {
    return Response.json(
      { error: "La categoria di fallback non può essere eliminata" },
      { status: 409 }
    );
  }

  const fallback = await getFallbackCategory(session.user.id);
  if (!fallback) {
    return Response.json({ error: "Categoria di fallback non trovata" }, { status: 500 });
  }

  await db.transaction(async (tx) => {
    await tx
      .update(transactions)
      .set({ categoryId: fallback.id })
      .where(eq(transactions.categoryId, id));
    await tx.delete(budgets).where(eq(budgets.categoryId, id));
    await tx.delete(categories).where(eq(categories.id, id));
  });

  return new Response(null, { status: 204 });
}
```

- [ ] **Step 8: Esegui i test, verifica che passino**

Run: `pnpm test app/api/categories/[id]/route.test.ts`
Expected: PASS

- [ ] **Step 9: Esegui l'intera suite di test**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add app/api/categories/route.ts app/api/categories/route.test.ts app/api/categories/[id]/route.ts app/api/categories/[id]/route.test.ts
git commit -m "feat: aggiunge creazione/modifica/eliminazione categoria via API"
```

---

### Task 6: Query client per le mutation categorie

**Files:**
- Modify: `lib/queries/categories.ts`

**Interfaces:**
- Consumes: `Category` (Task 3), `CreateCategoryInput`, `UpdateCategoryInput` (Task 2).
- Produces: `useCreateCategoryMutation()`, `useUpdateCategoryMutation()`, `useDeleteCategoryMutation()` — usate nel Task 7.

- [ ] **Step 1: Estendi `lib/queries/categories.ts`**

Aggiungi in fondo al file (dopo `useCategoriesQuery`):

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateCategoryInput, UpdateCategoryInput } from "@/lib/validation/categories";
```

(unisci questo import con quello già esistente `import { useQuery } from "@tanstack/react-query";` in cima al file, sostituendolo con `import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";`)

```ts
/** Crea una nuova categoria e invalida la lista al successo. */
export function useCreateCategoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCategoryInput) => {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Impossibile creare la categoria");
      }
      return response.json() as Promise<Category>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
    },
  });
}

/** Aggiorna una categoria esistente e invalida la lista al successo. */
export function useUpdateCategoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateCategoryInput }) => {
      const response = await fetch(`/api/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Impossibile aggiornare la categoria");
      }
      return response.json() as Promise<Category>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
    },
  });
}

/** Elimina una categoria (riassegnando le transazioni collegate) e invalida la lista al successo. */
export function useDeleteCategoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/categories/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Impossibile eliminare la categoria");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
    },
  });
}
```

- [ ] **Step 2: Verifica che il progetto compili**

Run: `pnpm lint`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add lib/queries/categories.ts
git commit -m "feat: aggiunge mutation crea/aggiorna/elimina categoria"
```

---

### Task 7: Pagina di gestione categorie `/categorie`

**Files:**
- Create: `components/domain/categories/category-row.tsx`
- Create: `components/domain/categories/add-category-form.tsx`
- Modify: `components/domain/categories/index.ts`
- Create: `app/(app)/categorie/page.tsx`

**Interfaces:**
- Consumes: `CategoryAvatar`, `CategoryIconColorPicker` (Task 4); `useCategoriesQuery`, `useCreateCategoryMutation`, `useUpdateCategoryMutation`, `useDeleteCategoryMutation` (Task 6); `Category` (Task 3); `CATEGORY_COLORS`/`CATEGORY_ICONS` di default (Task 2, per `add-category-form.tsx`).
- Produces: `CategoryRow({ category })`, `AddCategoryForm({ onSuccess? })` — usati solo dalla pagina `/categorie`.

- [ ] **Step 1: Crea `category-row.tsx`**

```tsx
"use client";

/**
 * Riga singola nella pagina Categorie. Nome, tipo, icona e colore sono editabili
 * inline (salvataggio on-blur/on-change). L'eliminazione è bloccata (bottone
 * disabilitato con tooltip) per la categoria fallback "Da categorizzare".
 */

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Trash2 } from "lucide-react";
import { useDeleteCategoryMutation, useUpdateCategoryMutation } from "@/lib/queries/categories";
import type { Category } from "@/lib/db/schema/categories";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
import { CategoryAvatar } from "./category-avatar";
import { CategoryIconColorPicker } from "./category-icon-color-picker";

const TYPE_LABELS: Record<"fissa" | "variabile", string> = {
  fissa: "Fissa",
  variabile: "Variabile",
};

export interface CategoryRowProps {
  category: Category;
}

export function CategoryRow({ category }: CategoryRowProps) {
  const updateMutation = useUpdateCategoryMutation();
  const deleteMutation = useDeleteCategoryMutation();

  const [name, setName] = React.useState(category.name);
  const [confirmDialogOpen, setConfirmDialogOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function commitName() {
    if (name.trim() === "" || name === category.name) {
      setName(category.name);
      return;
    }
    setError(null);
    updateMutation.mutate(
      { id: category.id, input: { name: name.trim() } },
      {
        onError: (mutationError) => {
          setError(mutationError.message);
          setName(category.name);
        },
      }
    );
  }

  function commitType(type: string | null) {
    if (type === null || type === category.type) return;
    updateMutation.mutate({ id: category.id, input: { type: type as "fissa" | "variabile" } });
  }

  function handleAppearanceChange(next: { color: CategoryColor; icon: CategoryIcon }) {
    if (next.color !== category.color) {
      updateMutation.mutate({ id: category.id, input: { color: next.color } });
    }
    if (next.icon !== category.icon) {
      updateMutation.mutate({ id: category.id, input: { icon: next.icon } });
    }
  }

  function handleDeleteConfirm() {
    deleteMutation.mutate(category.id, {
      onSuccess: () => setConfirmDialogOpen(false),
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <CategoryIconColorPicker
          value={{ color: category.color as CategoryColor, icon: category.icon as CategoryIcon }}
          onChange={handleAppearanceChange}
        >
          <CategoryAvatar color={category.color as CategoryColor} icon={category.icon as CategoryIcon} />
        </CategoryIconColorPicker>

        <div className="min-w-0 flex-1 space-y-1">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            className="h-7 w-full text-sm font-medium"
            aria-label="Nome categoria"
          />
          <Select value={category.type} onValueChange={commitType}>
            <SelectTrigger size="sm" className="h-6 w-fit text-xs">
              <SelectValue>
                {(value: "fissa" | "variabile") => TYPE_LABELS[value]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fissa">Fissa</SelectItem>
              <SelectItem value="variabile">Variabile</SelectItem>
            </SelectContent>
          </Select>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {category.isFallback && (
          <Badge variant="secondary" className="text-[10px]">
            Fallback
          </Badge>
        )}

        <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
          <AlertDialogTrigger
            disabled={category.isFallback}
            title={category.isFallback ? "La categoria di fallback non può essere eliminata" : undefined}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-40"
            aria-label="Elimina categoria"
          >
            <Trash2 size={14} />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminare questa categoria?</AlertDialogTitle>
              <AlertDialogDescription>
                &quot;{category.name}&quot; verrà eliminata. Le transazioni collegate saranno riassegnate a
                &quot;Da categorizzare&quot; e il budget associato verrà rimosso.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {deleteMutation.isError && (
              <p className="text-sm text-destructive">Eliminazione non riuscita, riprova.</p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteConfirm} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? "Eliminazione..." : "Elimina"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Crea `add-category-form.tsx`**

```tsx
"use client";

/** Form "+ Nuova categoria": crea una categoria con nome, tipo e icona/colore di default (personalizzabili subito dopo dalla riga). */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateCategoryMutation } from "@/lib/queries/categories";

const TYPE_LABELS: Record<"fissa" | "variabile", string> = {
  fissa: "Fissa",
  variabile: "Variabile",
};

export interface AddCategoryFormProps {
  /** Callback richiamata alla creazione con successo della categoria. */
  onSuccess?: () => void;
}

export function AddCategoryForm({ onSuccess }: AddCategoryFormProps) {
  const createMutation = useCreateCategoryMutation();
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<"fissa" | "variabile">("variabile");
  const [error, setError] = React.useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (name.trim() === "") {
      setError("Il nome è obbligatorio");
      return;
    }

    createMutation.mutate(
      { name: name.trim(), type },
      {
        onSuccess: () => {
          setName("");
          setType("variabile");
          onSuccess?.();
        },
        onError: (mutationError) => setError(mutationError.message),
      }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 border-t border-border p-4">
      <div className="flex flex-1 flex-col gap-1">
        <label className="text-xs font-medium text-foreground" htmlFor="new-category-name">
          Nome
        </label>
        <Input
          id="new-category-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Es. Palestra"
          className="w-full"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-foreground">Tipo</label>
        <Select value={type} onValueChange={(value) => value && setType(value as "fissa" | "variabile")}>
          <SelectTrigger className="w-32">
            <SelectValue>{(value: "fissa" | "variabile") => TYPE_LABELS[value]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fissa">Fissa</SelectItem>
            <SelectItem value="variabile">Variabile</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" disabled={createMutation.isPending}>
        {createMutation.isPending ? "Aggiunta in corso..." : "Aggiungi categoria"}
      </Button>

      {error && <p className="w-full text-sm text-destructive">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 3: Aggiorna il barrel `components/domain/categories/index.ts`**

Aggiungi in fondo al file:

```ts
export { CategoryRow } from "./category-row";
export type { CategoryRowProps } from "./category-row";
export { AddCategoryForm } from "./add-category-form";
export type { AddCategoryFormProps } from "./add-category-form";
```

- [ ] **Step 4: Crea `app/(app)/categorie/page.tsx`**

```tsx
"use client";

/** Pagina Categorie: elenco categorie dell'utente con gestione completa (crea/rinomina/elimina/icona/colore). */

import { AddCategoryForm, CategoryRow } from "@/components/domain/categories";
import { Card } from "@/components/ui/card";
import { useCategoriesQuery } from "@/lib/queries/categories";

export default function CategoriePage() {
  const { data: categories, isLoading, isError, refetch } = useCategoriesQuery();
  const safeCategories = categories ?? [];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <h1 className="font-heading text-2xl font-medium text-foreground">Categorie</h1>
        <p className="text-sm text-muted-foreground">
          Gestisci le categorie di spesa: nome, tipo, icona e colore.
        </p>
      </div>

      {isLoading ? (
        <div className="h-48 animate-pulse rounded-xl bg-muted" aria-busy="true" />
      ) : isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Impossibile caricare le categorie.{" "}
          <button onClick={() => refetch()} className="underline underline-offset-2">
            Riprova
          </button>
        </div>
      ) : (
        <Card className="p-0">
          {safeCategories.map((category) => (
            <CategoryRow key={category.id} category={category} />
          ))}
          <AddCategoryForm />
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Verifica manuale nel browser**

Run: `pnpm dev`, poi apri `http://localhost:3000/categorie` da loggato.
Expected: elenco delle 9 categorie seminate, ognuna con avatar cliccabile (apre il picker), nome/tipo editabili, bottone elimina disabilitato solo su "Da categorizzare"; il form in fondo crea una nuova categoria e la mostra subito in lista.

- [ ] **Step 6: Commit**

```bash
git add components/domain/categories/category-row.tsx components/domain/categories/add-category-form.tsx components/domain/categories/index.ts "app/(app)/categorie/page.tsx"
git commit -m "feat: aggiunge la pagina di gestione categorie"
```

---

### Task 8: Integrazione in Spese (link, avatar categoria nelle liste)

**Files:**
- Modify: `app/(app)/spese/page.tsx`
- Modify: `components/domain/expenses/category-breakdown.tsx`
- Modify: `components/domain/expenses/transaction-row.tsx`
- Modify: `lib/calc/expenses.ts`
- Modify: `lib/calc/expenses.test.ts`

**Interfaces:**
- Consumes: `CategoryAvatar` (Task 4); `Category` con `color`/`icon`/`isFallback` (Task 3).
- Produces: `CategoryAmount` esteso con `color: string; icon: string` (Step 1), consumato da `category-breakdown.tsx`.

- [ ] **Step 1: Aggiungi `color`/`icon` a `CategoryAmount` in `lib/calc/expenses.ts`**

`CategoryAmount` oggi (righe 175-180) è:

```ts
export interface CategoryAmount {
  categoryId: string;
  name: string;
  type: "fissa" | "variabile";
  amount: number;
}
```

Sostituiscilo con:

```ts
export interface CategoryAmount {
  categoryId: string;
  name: string;
  type: "fissa" | "variabile";
  amount: number;
  color: string;
  icon: string;
}
```

E in `computeCategoryBreakdown` (righe 193-202), nell'oggetto ritornato dentro `categories.map(...)`, sostituisci:

```ts
return {
  categoryId: category.id,
  name: category.name,
  type: category.type,
  amount: speseEffettive,
};
```

con:

```ts
return {
  categoryId: category.id,
  name: category.name,
  type: category.type,
  amount: speseEffettive,
  color: category.color,
  icon: category.icon,
};
```

- [ ] **Step 2: Aggiorna `makeCategory` e le aspettative in `lib/calc/expenses.test.ts`**

`Category` ha ora anche `color`/`icon`/`isFallback` obbligatori (Task 3): la factory `makeCategory` (righe 49-58) non compila più senza aggiornarla. Sostituiscila con:

```ts
function makeCategory(overrides: Partial<Category>): Category {
  return {
    id: "category-1",
    userId: "user-1",
    name: "Categoria",
    type: "variabile",
    color: "slate",
    icon: "package",
    isFallback: false,
    createdAt: new Date(),
    ...overrides,
  };
}
```

Il test `computeCategoryBreakdown` (righe 183-186) confronta l'intero oggetto con `toEqual`, quindi va aggiornato per includere i nuovi campi restituiti da `CategoryAmount` (Step 1 di questo task):

```ts
expect(breakdown).toEqual([
  { categoryId: "cat-a", name: "Spesa alimentare", type: "variabile", amount: 90, color: "slate", icon: "package" },
  { categoryId: "cat-b", name: "Affitto", type: "fissa", amount: 0, color: "slate", icon: "package" },
]);
```

Run: `pnpm test lib/calc/expenses.test.ts`
Expected: PASS

- [ ] **Step 3: Aggiorna `category-breakdown.tsx` per mostrare l'avatar**

In `CategoryBreakdownRow` (interno al file), importa `CategoryAvatar` e `CategoryColor`/`CategoryIcon`:

```ts
import { CategoryAvatar } from "@/components/domain/categories";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
```

Nel JSX della riga, sostituisci il blocco:

```tsx
<div>
  <p className="text-sm font-medium text-foreground">{entry.name}</p>
  <p className="text-xs text-muted-foreground">{formatCurrency(entry.amount, currency)} speso</p>
</div>
```

con:

```tsx
<div className="flex items-center gap-3">
  <CategoryAvatar
    color={entry.color as CategoryColor}
    icon={entry.icon as CategoryIcon}
    size={14}
    className="size-7"
  />
  <div>
    <p className="text-sm font-medium text-foreground">{entry.name}</p>
    <p className="text-xs text-muted-foreground">{formatCurrency(entry.amount, currency)} speso</p>
  </div>
</div>
```

- [ ] **Step 4: Aggiorna `transaction-row.tsx` per mostrare l'avatar nel select categoria**

Importa `CategoryAvatar` e i tipi icona/colore:

```ts
import { CategoryAvatar } from "@/components/domain/categories";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
```

Sostituisci il blocco `<SelectValue>` esistente (righe 102-104):

```tsx
<SelectValue>
  {(value: string | null) => categories.find((c) => c.id === value)?.name ?? ""}
</SelectValue>
```

con:

```tsx
<SelectValue>
  {(value: string | null) => {
    const selected = categories.find((c) => c.id === value);
    if (!selected) return "";
    return (
      <span className="flex items-center gap-1.5">
        <CategoryAvatar
          color={selected.color as CategoryColor}
          icon={selected.icon as CategoryIcon}
          size={10}
          className="size-4"
        />
        {selected.name}
      </span>
    );
  }}
</SelectValue>
```

- [ ] **Step 5: Aggiungi il link "Gestisci categorie" in `app/(app)/spese/page.tsx`**

Nell'header della pagina, dopo il blocco `<p>` con l'intervallo di date (circa riga 68), aggiungi:

```tsx
<a
  href="/categorie"
  className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
>
  Gestisci categorie
</a>
```

Posizionalo dentro il `<div>` che contiene già titolo e intervallo date, come elemento fratello di quel `<p>`, oppure come elemento a sé nel `<div className="flex flex-wrap items-center justify-between gap-3">` esterno accanto a `ExpensesPeriodSelector` — la seconda opzione è preferibile per non affollare il blocco titolo. Aggiungilo quindi subito prima di `<ExpensesPeriodSelector value={period} onChange={setPeriod} />`.

- [ ] **Step 6: Verifica manuale nel browser**

Run: `pnpm dev`, apri `/spese`.
Expected: link "Gestisci categorie" nell'header porta a `/categorie`; il blocco "Per categoria" mostra l'avatar di ciascuna categoria; il select categoria di ogni transazione mostra l'avatar accanto al nome (non più solo testo, e non l'id grezzo).

- [ ] **Step 7: Esegui l'intera suite di test**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add "app/(app)/spese/page.tsx" components/domain/expenses/category-breakdown.tsx components/domain/expenses/transaction-row.tsx lib/calc/expenses.ts lib/calc/expenses.test.ts
git commit -m "feat: mostra icona/colore categoria in Spese e collega la pagina Categorie"
```

---

## Note finali

- **Fuori scope** (rimandato, vedi spec): sezione Budget separata; colori categoria nei grafici di Spese (nessun grafico per-categoria oggi); i18n dei nomi categoria.
- Dopo l'esecuzione completa, aggiornare `CLAUDE.md` (sezione "Stato del progetto" + "Log delle decisioni") con l'esito di questo piano, come da convenzione del progetto.
