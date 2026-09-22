# Gruppi di spesa per le categorie — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sostituire i tipi categoria `fissa`/`variabile` con quattro gruppi di spesa (Dovute, Volute, Te futuro, Saltuarie) in DB, categorie di default, statistiche (torta Transazioni, "Dove va ogni euro" in Cash flow) e pagina `/categorie`, più uno script di reset delle categorie esistenti.

**Architecture:** Un modulo puro `lib/categories/groups.ts` è l'unica fonte di verità per tipi, ordine, etichette e colori dei gruppi; tutto il resto lo importa invece di ripetere unioni letterali. L'enum Postgres `category_type` viene rinominato/esteso da uno script idempotente; un secondo script riporta le categorie di ogni utente alla nuova lista di default, con la logica di decisione in una funzione pura testata.

**Tech Stack:** Next.js App Router, TypeScript, Drizzle ORM + postgres-js, Zod, TanStack Query, Recharts (via shadcn `Chart`), Tailwind v4 token, vitest, pnpm, tsx.

**Spec:** `docs/superpowers/specs/2026-09-22-categorie-gruppi-spesa-design.md`

## Global Constraints

- Valori enum `category_type`, in quest'ordine: `dovuta`, `voluta`, `futuro`, `saltuaria`, `entrata`.
- Etichette UI: `Dovute`, `Volute`, `Te futuro`, `Saltuarie`; entrate: `Entrata`; fallback: `Da categorizzare`.
- "Te futuro" conta come spesa normale ovunque (nessun totale cambia).
- La categoria fallback (`isFallback: true`) non viene mai classificata per `type`: nelle statistiche va nel bucket "Da categorizzare" / "Non classificato". Il suo `type` nel DB è `voluta`.
- Nessun colore hex nei componenti: solo token (`--group-*`) definiti in `app/globals.css` per `:root` e `.dark`.
- Nessuna unione letterale `"fissa" | "variabile" | ...` o `"dovuta" | ...` fuori da `lib/categories/groups.ts`: usare `CategoryType` / `ExpenseGroup` / `CategoryGroupKey`.
- JSDoc di una riga su ogni funzione/componente pubblico nuovo o modificato.
- Tutte le stringhe UI in italiano.
- Comandi test: `pnpm exec vitest run <path>`; tipi: `pnpm exec tsc --noEmit`; lint: `pnpm lint`.
- Fallimenti noti e non correlati da ignorare: 3 test in `lib/gocardless/scheduler.test.ts`; 2 errori lint `react-hooks/set-state-in-effect` in `components/theme-toggle.tsx` e `CategoryLegendRow`.
- **DB condiviso**: molti test API (`app/api/**/route.test.ts`) usano il Postgres reale. Lo script di migrazione enum (Task 2) va eseguito **dall'utente** prima di far girare quei test; non eseguire `ALTER TYPE`/`db:push` di propria iniziativa.
- Git: solo `add`/`commit` nel worktree assegnato; nessun `fetch`/`reset`/`merge`/`push`.

## Review Focus

1. **Categoria personalizzata con transazioni al reset** → le transazioni devono finire su "Da categorizzare", non essere perse né far fallire la FK (test in Task 7 su `planCategoryReset` + ordine delle operazioni in `resetUserCategories`).
2. **Utente che ha sia il nome legacy sia il nome nuovo** (es. "Salute & Cura" e "Salute & Farmaci") → vince il nome esatto, la legacy va eliminata, nessuna violazione del vincolo unique `(user_id, name)` (test in Task 7).
3. **Spese sulla fallback** → mai contate in un gruppo: fetta grigia "Da categorizzare" nella torta, "Non classificato" in Cash flow (test in Task 3 e Task 4).
4. **Script eseguiti due volte** → migrazione enum e reset sono no-op alla seconda esecuzione (test del piano "già resettato" in Task 7; la migrazione legge `pg_enum` prima di agire, Task 2).
5. **Torta con "Da categorizzare" > 0** → anello esterno ordinato con la fallback in coda, allineato all'anello interno (test di `sortCategoryAmounts` in Task 3).

---

### Task 1: Modulo gruppi + token colore

**Files:**
- Create: `lib/categories/groups.ts`
- Create: `lib/categories/groups.test.ts`
- Modify: `app/globals.css` (blocco `@theme inline`, `:root`, `.dark`)

**Interfaces:**
- Consumes: nulla.
- Produces (usati da tutti i task successivi):
  - `CATEGORY_TYPES: readonly ["dovuta","voluta","futuro","saltuaria","entrata"]`, `type CategoryType`
  - `EXPENSE_GROUP_KEYS: readonly ["dovuta","voluta","futuro","saltuaria"]`, `type ExpenseGroup`
  - `UNCATEGORIZED_GROUP_KEY = "daCategorizzare"`, `type CategoryGroupKey = ExpenseGroup | "daCategorizzare"`
  - `EXPENSE_GROUPS: Record<ExpenseGroup, ExpenseGroupInfo>` con `{ label, shortDescription, colorVar, dotClassName }`
  - `GROUP_DISPLAY: Record<CategoryGroupKey, GroupDisplay>` con `{ label, colorVar, dotClassName }`
  - `CATEGORY_TYPE_LABELS: Record<CategoryType, string>`
  - `DEFAULT_NEW_CATEGORY_TYPE: CategoryType` (= `"voluta"`)
  - `isExpenseGroup(type: string): type is ExpenseGroup`
  - `categoryGroupKey(category: { type: string; isFallback: boolean }): CategoryGroupKey | null` (null = entrata)
  - `groupCategoriesByType<T extends { type: string; isFallback: boolean }>(categories: T[]): CategorySections<T>`
    con `CategorySections<T> = { groups: { key: ExpenseGroup; categories: T[] }[]; uncategorized: T[]; income: T[] }`

- [ ] **Step 1: Scrivi i test**

`lib/categories/groups.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  CATEGORY_TYPE_LABELS,
  CATEGORY_TYPES,
  EXPENSE_GROUP_KEYS,
  EXPENSE_GROUPS,
  GROUP_DISPLAY,
  categoryGroupKey,
  groupCategoriesByType,
  isExpenseGroup,
} from "./groups";

function cat(id: string, type: string, isFallback = false) {
  return { id, type, isFallback };
}

describe("costanti gruppi", () => {
  it("i gruppi di spesa sono i tipi categoria meno 'entrata', nello stesso ordine", () => {
    expect(EXPENSE_GROUP_KEYS).toEqual(["dovuta", "voluta", "futuro", "saltuaria"]);
    expect(CATEGORY_TYPES).toEqual(["dovuta", "voluta", "futuro", "saltuaria", "entrata"]);
  });

  it("ha un'etichetta per ogni tipo categoria", () => {
    expect(CATEGORY_TYPE_LABELS).toEqual({
      dovuta: "Dovute",
      voluta: "Volute",
      futuro: "Te futuro",
      saltuaria: "Saltuarie",
      entrata: "Entrata",
    });
  });

  it("ogni gruppo punta a un token CSS e non a un colore letterale", () => {
    for (const key of EXPENSE_GROUP_KEYS) {
      expect(EXPENSE_GROUPS[key].colorVar).toBe(`var(--group-${key})`);
      expect(EXPENSE_GROUPS[key].shortDescription.length).toBeGreaterThan(0);
    }
    expect(GROUP_DISPLAY.daCategorizzare).toEqual({
      label: "Da categorizzare",
      colorVar: "var(--group-uncategorized)",
      dotClassName: "bg-group-uncategorized",
    });
  });
});

describe("isExpenseGroup / categoryGroupKey", () => {
  it("riconosce solo i quattro gruppi di spesa", () => {
    expect(isExpenseGroup("futuro")).toBe(true);
    expect(isExpenseGroup("entrata")).toBe(false);
    expect(isExpenseGroup("fissa")).toBe(false);
  });

  it("la fallback va in daCategorizzare qualunque sia il suo type", () => {
    expect(categoryGroupKey(cat("f", "voluta", true))).toBe("daCategorizzare");
  });

  it("entrata → null, gruppo → se stesso, tipo sconosciuto → daCategorizzare", () => {
    expect(categoryGroupKey(cat("e", "entrata"))).toBeNull();
    expect(categoryGroupKey(cat("s", "saltuaria"))).toBe("saltuaria");
    expect(categoryGroupKey(cat("x", "boh"))).toBe("daCategorizzare");
  });
});

describe("groupCategoriesByType", () => {
  it("divide in quattro gruppi ordinati, fallback a parte, entrate in fondo, preservando l'ordine di input", () => {
    const sections = groupCategoriesByType([
      cat("stipendio", "entrata"),
      cat("netflix", "voluta"),
      cat("fallback", "voluta", true),
      cat("affitto", "dovuta"),
      cat("cinema", "voluta"),
    ]);
    expect(sections.groups.map((g) => g.key)).toEqual(["dovuta", "voluta", "futuro", "saltuaria"]);
    expect(sections.groups[0].categories.map((c) => c.id)).toEqual(["affitto"]);
    expect(sections.groups[1].categories.map((c) => c.id)).toEqual(["netflix", "cinema"]);
    expect(sections.groups[2].categories).toEqual([]);
    expect(sections.uncategorized.map((c) => c.id)).toEqual(["fallback"]);
    expect(sections.income.map((c) => c.id)).toEqual(["stipendio"]);
  });

  it("con lista vuota restituisce comunque i quattro gruppi vuoti", () => {
    const sections = groupCategoriesByType([]);
    expect(sections.groups).toHaveLength(4);
    expect(sections.uncategorized).toEqual([]);
    expect(sections.income).toEqual([]);
  });
});
```

- [ ] **Step 2: Verifica che falliscano**

Run: `pnpm exec vitest run lib/categories/groups.test.ts`
Expected: FAIL — `Failed to resolve import "./groups"`.

- [ ] **Step 3: Implementa `lib/categories/groups.ts`**

```ts
/**
 * Gruppi di spesa delle categorie (Dovute / Volute / Te futuro / Saltuarie) e tipo "entrata": unica fonte
 * di verità per valori, ordine, etichette e token colore. Modulo puro, senza dipendenze da React o DB.
 */

export const CATEGORY_TYPES = ["dovuta", "voluta", "futuro", "saltuaria", "entrata"] as const;
export type CategoryType = (typeof CATEGORY_TYPES)[number];

export const EXPENSE_GROUP_KEYS = ["dovuta", "voluta", "futuro", "saltuaria"] as const;
export type ExpenseGroup = (typeof EXPENSE_GROUP_KEYS)[number];

/** Bucket statistico delle spese su categoria fallback (o non classificabile): non è un tipo categoria. */
export const UNCATEGORIZED_GROUP_KEY = "daCategorizzare";
export type CategoryGroupKey = ExpenseGroup | typeof UNCATEGORIZED_GROUP_KEY;

export interface GroupDisplay {
  label: string;
  /** Token CSS del colore del gruppo, da usare come `fill` nei grafici. */
  colorVar: string;
  /** Classe Tailwind letterale per il pallino colore (letterale per il JIT). */
  dotClassName: string;
}

export interface ExpenseGroupInfo extends GroupDisplay {
  shortDescription: string;
}

export const EXPENSE_GROUPS: Record<ExpenseGroup, ExpenseGroupInfo> = {
  dovuta: {
    label: "Dovute",
    shortDescription: "Necessarie per vivere: senza queste avresti problemi pratici o legali.",
    colorVar: "var(--group-dovuta)",
    dotClassName: "bg-group-dovuta",
  },
  voluta: {
    label: "Volute",
    shortDescription: "Migliorano la qualità della vita, ma potresti farne a meno.",
    colorVar: "var(--group-voluta)",
    dotClassName: "bg-group-voluta",
  },
  futuro: {
    label: "Te futuro",
    shortDescription: "Risparmio e investimenti come spesa prioritaria, non come avanzo.",
    colorVar: "var(--group-futuro)",
    dotClassName: "bg-group-futuro",
  },
  saltuaria: {
    label: "Saltuarie",
    shortDescription: "Necessarie ma non mensili: tasse annuali, manutenzioni, regali.",
    colorVar: "var(--group-saltuaria)",
    dotClassName: "bg-group-saltuaria",
  },
};

export const GROUP_DISPLAY: Record<CategoryGroupKey, GroupDisplay> = {
  ...EXPENSE_GROUPS,
  daCategorizzare: {
    label: "Da categorizzare",
    colorVar: "var(--group-uncategorized)",
    dotClassName: "bg-group-uncategorized",
  },
};

export const CATEGORY_TYPE_LABELS: Record<CategoryType, string> = {
  dovuta: EXPENSE_GROUPS.dovuta.label,
  voluta: EXPENSE_GROUPS.voluta.label,
  futuro: EXPENSE_GROUPS.futuro.label,
  saltuaria: EXPENSE_GROUPS.saltuaria.label,
  entrata: "Entrata",
};

/** Tipo proposto di default quando l'utente crea una nuova categoria. */
export const DEFAULT_NEW_CATEGORY_TYPE: CategoryType = "voluta";

/** True se `type` è uno dei quattro gruppi di spesa (esclude "entrata" e valori sconosciuti). */
export function isExpenseGroup(type: string): type is ExpenseGroup {
  return (EXPENSE_GROUP_KEYS as readonly string[]).includes(type);
}

/**
 * Bucket statistico di una categoria: la fallback e i tipi sconosciuti vanno in "daCategorizzare",
 * i gruppi di spesa in se stessi, le entrate in `null` (non sono spese).
 */
export function categoryGroupKey(category: { type: string; isFallback: boolean }): CategoryGroupKey | null {
  if (category.isFallback) return UNCATEGORIZED_GROUP_KEY;
  if (category.type === "entrata") return null;
  return isExpenseGroup(category.type) ? category.type : UNCATEGORIZED_GROUP_KEY;
}

export interface CategorySections<T> {
  /** Sempre tutti e quattro i gruppi, nell'ordine di EXPENSE_GROUP_KEYS, anche se vuoti. */
  groups: { key: ExpenseGroup; categories: T[] }[];
  uncategorized: T[];
  income: T[];
}

/** Divide le categorie in sezioni per la pagina Categorie, preservando l'ordine di input dentro ogni sezione. */
export function groupCategoriesByType<T extends { type: string; isFallback: boolean }>(
  categories: T[]
): CategorySections<T> {
  const sections: CategorySections<T> = {
    groups: EXPENSE_GROUP_KEYS.map((key) => ({ key, categories: [] as T[] })),
    uncategorized: [],
    income: [],
  };
  for (const category of categories) {
    const key = categoryGroupKey(category);
    if (key === null) sections.income.push(category);
    else if (key === UNCATEGORIZED_GROUP_KEY) sections.uncategorized.push(category);
    else sections.groups.find((group) => group.key === key)!.categories.push(category);
  }
  return sections;
}
```

- [ ] **Step 4: Aggiungi i token colore in `app/globals.css`**

Nel blocco `@theme inline`, subito dopo `--color-text-3: var(--text-3);`:

```css
  --color-group-dovuta: var(--group-dovuta);
  --color-group-voluta: var(--group-voluta);
  --color-group-futuro: var(--group-futuro);
  --color-group-saltuaria: var(--group-saltuaria);
  --color-group-uncategorized: var(--group-uncategorized);
```

In `:root`, subito dopo `--chart-5: #b6c4bc;`:

```css
  --group-dovuta: #dc2626;
  --group-voluta: #d97706;
  --group-futuro: #16a34a;
  --group-saltuaria: #2563eb;
  --group-uncategorized: #94a3b8;
```

In `.dark`, subito dopo `--chart-5: #2f4940;`:

```css
  --group-dovuta: #f87171;
  --group-voluta: #facc15;
  --group-futuro: #4ade80;
  --group-saltuaria: #60a5fa;
  --group-uncategorized: #64748b;
```

(Giallo chiaro-tema scelto ambra scuro `#d97706` per contrasto come fill su sfondo chiaro.)

- [ ] **Step 5: Verifica**

Run: `pnpm exec vitest run lib/categories/groups.test.ts`
Expected: PASS (8 test).

- [ ] **Step 6: Commit**

```bash
git add lib/categories/groups.ts lib/categories/groups.test.ts app/globals.css
git commit -m "feat(categorie): modulo gruppi di spesa e token colore"
```

---

### Task 2: Cambio enum — schema, default, validazione, categorizzazione, script di migrazione

**Files:**
- Modify: `lib/db/schema/categories.ts`
- Modify: `lib/db/schema/categories.test.ts`
- Modify: `lib/validation/categories.ts`
- Modify: `lib/categorization/fallback.ts:23`
- Modify: `lib/categorization/match-rule.ts:6,18`
- Modify: `lib/categorization/suggest.ts:19`
- Modify: `app/api/transactions/route.ts:55` (solo JSDoc)
- Create: `lib/db/migrate-category-groups.ts`
- Modify: `package.json` (script)
- Modify: tutti i `*.test.ts` sotto `app/` e `lib/` che contengono `"fissa"` o `"variabile"` (rinomina meccanica)

**Interfaces:**
- Consumes: `CATEGORY_TYPES`, `CategoryType` (Task 1).
- Produces: `Category["type"]` ora è `CategoryType`; `DEFAULT_CATEGORIES` con la nuova lista; `LEGACY_CATEGORY_NAMES: Record<string, string>` (vecchio nome → nuovo nome) esportato da `lib/db/schema/categories.ts`, usato dal Task 7.

- [ ] **Step 1: Aggiorna il test delle categorie di default**

Sostituisci interamente `lib/db/schema/categories.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CATEGORY_COLORS, CATEGORY_ICONS } from "@/lib/validation/categories";
import { CATEGORY_TYPES, EXPENSE_GROUP_KEYS } from "@/lib/categories/groups";
import { DEFAULT_CATEGORIES, LEGACY_CATEGORY_NAMES } from "./categories";

describe("DEFAULT_CATEGORIES", () => {
  it("ha 25 categorie con nomi unici", () => {
    expect(DEFAULT_CATEGORIES).toHaveLength(25);
    expect(new Set(DEFAULT_CATEGORIES.map((c) => c.name)).size).toBe(25);
  });

  it("ogni categoria ha icona, colore e tipo validi", () => {
    for (const category of DEFAULT_CATEGORIES) {
      expect(CATEGORY_ICONS).toContain(category.icon);
      expect(CATEGORY_COLORS).toContain(category.color);
      expect(CATEGORY_TYPES).toContain(category.type);
    }
  });

  it("solo 'Da categorizzare' è isFallback, rossa con help-circle", () => {
    const fallbackEntries = DEFAULT_CATEGORIES.filter((c) => c.isFallback === true);
    expect(fallbackEntries).toHaveLength(1);
    expect(fallbackEntries[0]).toMatchObject({ name: "Da categorizzare", color: "red", icon: "help-circle" });
  });

  it("ogni gruppo di spesa ha almeno una categoria non fallback", () => {
    for (const group of EXPENSE_GROUP_KEYS) {
      expect(DEFAULT_CATEGORIES.some((c) => c.type === group && !c.isFallback)).toBe(true);
    }
  });

  it("ha 3 categorie di tipo entrata: Stipendio, Freelance, Dividendi e interessi", () => {
    const incomeEntries = DEFAULT_CATEGORIES.filter((c) => c.type === "entrata");
    expect(incomeEntries.map((c) => c.name).sort()).toEqual(
      ["Dividendi e interessi", "Freelance", "Stipendio"].sort()
    );
  });

  it("ogni nome legacy punta a una categoria di default esistente", () => {
    const names = new Set(DEFAULT_CATEGORIES.map((c) => c.name));
    for (const target of Object.values(LEGACY_CATEGORY_NAMES)) {
      expect(names.has(target)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Verifica che fallisca**

Run: `pnpm exec vitest run lib/db/schema/categories.test.ts`
Expected: FAIL (lunghezza 18 ≠ 25, `LEGACY_CATEGORY_NAMES` undefined).

- [ ] **Step 3: Aggiorna `lib/db/schema/categories.ts`**

Sostituisci la riga dell'enum e tutto da `export const DEFAULT_CATEGORIES` in fondo:

```ts
import { boolean, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { authUser } from "./auth";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
import { CATEGORY_TYPES, type CategoryType } from "@/lib/categories/groups";

export const categoryTypeEnum = pgEnum("category_type", CATEGORY_TYPES);
```

(tabella `categories` e tipi `Category`/`NewCategory` invariati)

```ts
export const DEFAULT_CATEGORIES: {
  name: string;
  type: CategoryType;
  icon: CategoryIcon;
  color: CategoryColor;
  isFallback?: boolean;
}[] = [
  // --- DOVUTE ---
  { name: "Affitto & Mutuo", type: "dovuta", icon: "home", color: "slate" },
  { name: "Bollette & Utenze", type: "dovuta", icon: "zap", color: "yellow" },
  { name: "Spesa alimentare", type: "dovuta", icon: "shopping-cart", color: "green" },
  { name: "Trasporti", type: "dovuta", icon: "bus", color: "blue" },
  { name: "Salute & Farmaci", type: "dovuta", icon: "pill", color: "rose" },
  { name: "Assicurazioni", type: "dovuta", icon: "shield", color: "indigo" },
  { name: "Rate & Finanziamenti", type: "dovuta", icon: "credit-card", color: "red" },

  // --- VOLUTE ---
  { name: "Ristoranti & Bar", type: "voluta", icon: "utensils", color: "orange" },
  { name: "Abbonamenti", type: "voluta", icon: "tv", color: "purple" },
  { name: "Svago & Hobby", type: "voluta", icon: "smile", color: "teal" },
  { name: "Sport & Palestra", type: "voluta", icon: "dumbbell", color: "lime" },
  { name: "Shopping", type: "voluta", icon: "shopping-bag", color: "pink" },
  { name: "Viaggi", type: "voluta", icon: "plane", color: "cyan" },

  // --- TE FUTURO ---
  { name: "Fondo emergenza", type: "futuro", icon: "wallet", color: "emerald" },
  { name: "Risparmio per obiettivi", type: "futuro", icon: "piggy-bank", color: "green" },
  { name: "Investimenti", type: "futuro", icon: "coins", color: "teal" },
  { name: "Pensione integrativa", type: "futuro", icon: "landmark", color: "indigo" },

  // --- SALTUARIE ---
  { name: "Tasse & Bolli", type: "saltuaria", icon: "receipt", color: "slate" },
  { name: "Manutenzione auto/casa", type: "saltuaria", icon: "wrench", color: "orange" },
  { name: "Regali", type: "saltuaria", icon: "gift", color: "pink" },
  { name: "Imprevisti", type: "saltuaria", icon: "alert-triangle", color: "amber" },

  // --- FALLBACK (nessun gruppo reale: il type è solo un valore non-null) ---
  { name: "Da categorizzare", type: "voluta", icon: "help-circle", color: "red", isFallback: true },

  // --- ENTRATE ---
  { name: "Stipendio", type: "entrata", icon: "banknote", color: "emerald" },
  { name: "Freelance", type: "entrata", icon: "briefcase", color: "blue" },
  { name: "Dividendi e interessi", type: "entrata", icon: "trending-up", color: "teal" },
];

/**
 * Nomi di categorie di default delle versioni precedenti → nome attuale. Usato dal reset categorie
 * per aggiornare (preservandone l'id e quindi transazioni/regole/budget) le categorie solo rinominate.
 */
export const LEGACY_CATEGORY_NAMES: Record<string, string> = {
  "Assicurazioni & Tasse": "Assicurazioni",
  "Risparmi & Investimenti": "Investimenti",
  "Trasporti & Auto": "Trasporti",
  "Salute & Cura": "Salute & Farmaci",
  "Svago & Hobbies": "Svago & Hobby",
};
```

Se `tsc` segnala che un colore (`lime`, `amber`, `emerald`, `rose`, `indigo`, `cyan`, `purple`, `teal`, `orange`, `pink`, `red`) non è in `CategoryColor`, sostituiscilo con uno presente in `SWATCH_BASE_COLORS` di `lib/validation/shared-colors.ts` (verifica prima con una lettura del file).

- [ ] **Step 4: Validazione, fallback, categorizzazione**

`lib/validation/categories.ts`: aggiungi `import { CATEGORY_TYPES } from "@/lib/categories/groups";` e sostituisci le due occorrenze di `z.enum(["fissa", "variabile", "entrata"])` con `z.enum(CATEGORY_TYPES)`.

`lib/categorization/fallback.ts`: `type: "variabile",` → `type: "voluta",` (con commento a fine riga: `// valore arbitrario: la fallback non viene mai classificata per type`).

`lib/categorization/match-rule.ts`: aggiungi `import type { CategoryType } from "@/lib/categories/groups";` e sostituisci le due `"fissa" | "variabile" | "entrata"` con `CategoryType`.

`lib/categorization/suggest.ts`: stessa sostituzione alla riga 19 (aggiungi l'import type).

`app/api/transactions/route.ts:55`: nel JSDoc `fissa/variabile → negato` → `gruppi di spesa → negato`.

- [ ] **Step 5: Rinomina meccanica nei fixture di test**

```bash
grep -rl --include=*.test.ts -e '"fissa"' -e '"variabile"' app lib | xargs sed -i 's/"fissa"/"dovuta"/g; s/"variabile"/"voluta"/g'
grep -rn --include=*.test.ts -e '"fissa"' -e '"variabile"' app lib
```
Expected seconda riga: nessun output. (La semantica è invariata: `dovuta`/`voluta` sono le rinomine 1:1 dei vecchi valori.)

- [ ] **Step 6: Script di migrazione enum**

Crea `lib/db/migrate-category-groups.ts`:

```ts
/**
 * Migrazione one-shot e idempotente dell'enum Postgres `category_type` da fissa/variabile/entrata a
 * dovuta/voluta/futuro/saltuaria/entrata (vedi docs/superpowers/specs/2026-09-22-categorie-gruppi-spesa-design.md).
 * Legge i valori correnti da pg_enum ed esegue solo i passi mancanti; `ADD VALUE` gira fuori da transazioni.
 * Esecuzione: `pnpm db:migrate-category-groups`.
 */
import { client } from "./client";

/** Passi SQL necessari a partire dai valori enum attuali (vuoto se la migrazione è già stata applicata). */
export function categoryEnumMigrationSteps(labels: string[]): string[] {
  const has = new Set(labels);
  const steps: string[] = [];
  if (has.has("fissa") && !has.has("dovuta")) {
    steps.push(`ALTER TYPE category_type RENAME VALUE 'fissa' TO 'dovuta'`);
  }
  if (has.has("variabile") && !has.has("voluta")) {
    steps.push(`ALTER TYPE category_type RENAME VALUE 'variabile' TO 'voluta'`);
  }
  if (!has.has("futuro")) {
    steps.push(`ALTER TYPE category_type ADD VALUE IF NOT EXISTS 'futuro' BEFORE 'entrata'`);
  }
  if (!has.has("saltuaria")) {
    steps.push(`ALTER TYPE category_type ADD VALUE IF NOT EXISTS 'saltuaria' BEFORE 'entrata'`);
  }
  return steps;
}

async function main() {
  const rows = await client.unsafe(
    `select e.enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid
     where t.typname = 'category_type' order by e.enumsortorder`
  );
  const labels = rows.map((row) => String(row.enumlabel));
  console.log("Valori attuali:", labels);

  const steps = categoryEnumMigrationSteps(labels);
  if (steps.length === 0) console.log("Nessun passo da eseguire: enum già migrato.");
  for (const step of steps) {
    console.log("→", step);
    await client.unsafe(step);
  }

  const after = await client.unsafe(
    `select e.enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid
     where t.typname = 'category_type' order by e.enumsortorder`
  );
  console.log("Valori finali:", after.map((row) => String(row.enumlabel)));
  await client.end();
}

if (process.argv[1]?.includes("migrate-category-groups")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
```

Crea `lib/db/migrate-category-groups.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { categoryEnumMigrationSteps } from "./migrate-category-groups";

describe("categoryEnumMigrationSteps", () => {
  it("dal vecchio enum rinomina due valori e ne aggiunge due prima di 'entrata'", () => {
    expect(categoryEnumMigrationSteps(["fissa", "variabile", "entrata"])).toEqual([
      "ALTER TYPE category_type RENAME VALUE 'fissa' TO 'dovuta'",
      "ALTER TYPE category_type RENAME VALUE 'variabile' TO 'voluta'",
      "ALTER TYPE category_type ADD VALUE IF NOT EXISTS 'futuro' BEFORE 'entrata'",
      "ALTER TYPE category_type ADD VALUE IF NOT EXISTS 'saltuaria' BEFORE 'entrata'",
    ]);
  });

  it("è un no-op sull'enum già migrato", () => {
    expect(categoryEnumMigrationSteps(["dovuta", "voluta", "futuro", "saltuaria", "entrata"])).toEqual([]);
  });

  it("riprende da una migrazione interrotta a metà", () => {
    expect(categoryEnumMigrationSteps(["dovuta", "voluta", "entrata"])).toEqual([
      "ALTER TYPE category_type ADD VALUE IF NOT EXISTS 'futuro' BEFORE 'entrata'",
      "ALTER TYPE category_type ADD VALUE IF NOT EXISTS 'saltuaria' BEFORE 'entrata'",
    ]);
  });
});
```

Verifica che `lib/db/client.ts` esporti `client` (lo usa già `lib/db/migrate.ts`). Poi in `package.json`, dopo `"db:clear"`:

```json
    "db:migrate-category-groups": "tsx --env-file=.env.local lib/db/migrate-category-groups.ts",
```

- [ ] **Step 7: Verifica unitaria**

Run: `pnpm exec vitest run lib/db/schema/categories.test.ts lib/db/migrate-category-groups.test.ts lib/categories lib/categorization lib/validation`
Expected: PASS.

Run: `pnpm exec tsc --noEmit`
Expected: errori **solo** nei file posseduti dai Task 3–6: `lib/calc/expenses.ts`, `lib/calc/expenses.test.ts`, `lib/calc/cashflow.ts`, `lib/calc/cashflow.test.ts`, `components/domain/expenses/category-breakdown-donut*.ts(x)`, `components/domain/cashflow/where-it-goes-breakdown.tsx`, `components/domain/categories/category-row.tsx`, `components/domain/categories/add-category-form.tsx`, `app/(app)/transazioni/page.tsx`. Qualunque errore in un altro file va risolto in questo task.

- [ ] **Step 8: Commit**

```bash
git add lib/db/schema/categories.ts lib/db/schema/categories.test.ts lib/validation/categories.ts lib/categorization lib/db/migrate-category-groups.ts lib/db/migrate-category-groups.test.ts package.json app/api/transactions/route.ts
git add $(git diff --name-only -- '*.test.ts')
git commit -m "feat(categorie): enum category_type a gruppi di spesa, nuovi default, script migrazione enum"
```

- [ ] **Step 9: Migrazione DB — STOP, la esegue l'utente**

Chiedi all'utente di eseguire, dalla directory di questo worktree:

```bash
pnpm db:migrate-category-groups
```

Output atteso: `Valori finali: [ 'dovuta', 'voluta', 'futuro', 'saltuaria', 'entrata' ]`. Avvisa che da questo momento il codice di `main` non mergiato è incompatibile col DB condiviso fino al merge. Non procedere ai test API finché l'utente non conferma.

Dopo conferma, run: `pnpm exec vitest run app/api lib/db lib/gocardless lib/net-worth`
Expected: PASS (salvo i 3 noti di `scheduler.test.ts`).

---

### Task 3: Motore Transazioni — `computeGroupTotals` e ordinamento torta

**Files:**
- Modify: `lib/calc/expenses.ts` (`CategoryAmount`, `computeCategoryBreakdown`, `FixedVsVariable`/`computeFixedVsVariable` → `GroupTotals`/`computeGroupTotals`)
- Modify: `lib/calc/expenses.test.ts:259-291` e `:547-560`
- Modify: `components/domain/expenses/category-breakdown-donut.utils.ts:1-11`
- Modify: `components/domain/expenses/category-breakdown-donut.utils.test.ts`

**Interfaces:**
- Consumes: `CategoryGroupKey`, `EXPENSE_GROUP_KEYS`, `UNCATEGORIZED_GROUP_KEY`, `categoryGroupKey` (Task 1).
- Produces:
  - `CategoryAmount = { categoryId: string; name: string; group: CategoryGroupKey; amount: number; color: string; icon: string }`
  - `type GroupTotals = Record<CategoryGroupKey, number>`
  - `computeGroupTotals(transactions, categories, period, referenceDate, today): GroupTotals` (stessa firma della vecchia `computeFixedVsVariable`)
  - `sortCategoryAmounts` ordina per `EXPENSE_GROUP_KEYS` poi `daCategorizzare`, poi importo decrescente.

- [ ] **Step 1: Aggiorna i test di `expenses.test.ts`**

Nell'import, `computeFixedVsVariable` → `computeGroupTotals`. Sostituisci i blocchi `describe("computeCategoryBreakdown", ...)` e `describe("computeFixedVsVariable", ...)` (righe 259-291) con:

```ts
describe("computeCategoryBreakdown", () => {
  it("somma la spesa effettiva per ciascuna categoria dell'utente, incluse quelle senza transazioni", () => {
    const categories = [
      makeCategory({ id: "cat-a", name: "Spesa alimentare", type: "dovuta" }),
      makeCategory({ id: "cat-b", name: "Netflix", type: "voluta" }),
    ];
    const transactions = [
      makeTransaction({ categoryId: "cat-a", date: "2026-02-05", amount: "-60.00" }),
      makeTransaction({ categoryId: "cat-a", date: "2026-02-06", amount: "-40.00", excludedAmount: "-10.00" }),
    ];
    const breakdown = computeCategoryBreakdown(transactions, categories, "mese", new Date(2026, 1, 15), new Date(2026, 1, 15));

    expect(breakdown).toEqual([
      { categoryId: "cat-a", name: "Spesa alimentare", group: "dovuta", amount: 90, color: "slate", icon: "package" },
      { categoryId: "cat-b", name: "Netflix", group: "voluta", amount: 0, color: "slate", icon: "package" },
    ]);
  });

  it("la categoria fallback ha group 'daCategorizzare' anche se il suo type è 'voluta'", () => {
    const categories = [makeCategory({ id: "cat-f", name: "Da categorizzare", type: "voluta", isFallback: true })];
    const transactions = [makeTransaction({ categoryId: "cat-f", date: "2026-02-05", amount: "-25.00" })];
    const [entry] = computeCategoryBreakdown(transactions, categories, "mese", new Date(2026, 1, 15), new Date(2026, 1, 15));
    expect(entry.group).toBe("daCategorizzare");
    expect(entry.amount).toBe(25);
  });
});

describe("computeGroupTotals", () => {
  it("somma la spesa effettiva del periodo per gruppo, con la fallback in daCategorizzare", () => {
    const categories = [
      makeCategory({ id: "cat-dov", type: "dovuta" }),
      makeCategory({ id: "cat-vol", type: "voluta" }),
      makeCategory({ id: "cat-fut", type: "futuro" }),
      makeCategory({ id: "cat-sal", type: "saltuaria" }),
      makeCategory({ id: "cat-fb", type: "voluta", isFallback: true }),
      makeCategory({ id: "cat-in", type: "entrata" }),
    ];
    const transactions = [
      makeTransaction({ categoryId: "cat-dov", date: "2026-02-05", amount: "-500.00" }),
      makeTransaction({ categoryId: "cat-vol", date: "2026-02-06", amount: "-60.00" }),
      makeTransaction({ categoryId: "cat-fut", date: "2026-02-07", amount: "-200.00" }),
      makeTransaction({ categoryId: "cat-sal", date: "2026-02-08", amount: "-90.00" }),
      makeTransaction({ categoryId: "cat-fb", date: "2026-02-09", amount: "-15.00" }),
      makeTransaction({ categoryId: "cat-in", date: "2026-02-01", amount: "1500.00" }),
    ];
    const result = computeGroupTotals(transactions, categories, "mese", new Date(2026, 1, 15), new Date(2026, 1, 15));
    expect(result).toEqual({ dovuta: 500, voluta: 60, futuro: 200, saltuaria: 90, daCategorizzare: 15 });
  });

  it("restituisce tutti i gruppi a zero senza transazioni", () => {
    const result = computeGroupTotals([], [], "mese", new Date(2026, 1, 15), new Date(2026, 1, 15));
    expect(result).toEqual({ dovuta: 0, voluta: 0, futuro: 0, saltuaria: 0, daCategorizzare: 0 });
  });
});
```

Nel blocco `describe("computeCategoryBreakdown esclude le categorie di entrata", ...)` (circa riga 547) sostituisci eventuali asserzioni su `type` con `group` (il `sed` del Task 2 ha già trasformato `"variabile"` in `"voluta"` nei fixture).

- [ ] **Step 2: Verifica che falliscano**

Run: `pnpm exec vitest run lib/calc/expenses.test.ts`
Expected: FAIL (`computeGroupTotals is not a function`, `group` undefined).

- [ ] **Step 3: Implementa in `lib/calc/expenses.ts`**

Aggiungi in cima: `import { EXPENSE_GROUP_KEYS, UNCATEGORIZED_GROUP_KEY, categoryGroupKey, type CategoryGroupKey } from "@/lib/categories/groups";`

Sostituisci `CategoryAmount`, `computeCategoryBreakdown`, `FixedVsVariable`, `computeFixedVsVariable` con:

```ts
export interface CategoryAmount {
  categoryId: string;
  name: string;
  /** Gruppo di spesa della categoria; la fallback (e tipi non riconosciuti) → "daCategorizzare". */
  group: CategoryGroupKey;
  amount: number;
  color: string;
  icon: string;
}

/** Spesa effettiva per categoria nel periodo selezionato, una riga per ogni categoria di spesa dell'utente (entrate escluse). */
export function computeCategoryBreakdown(
  transactions: Transaction[],
  categories: Category[],
  period: ExpensePeriod,
  referenceDate: Date,
  today: Date
): CategoryAmount[] {
  const range = getPeriodRange(period, referenceDate);
  const todayStart = startOfDay(today);
  const clampedToday = todayStart.getTime() < range.from.getTime() ? range.from : todayStart;
  const elapsedRange: DateRange = {
    from: range.from,
    to: clampedToday.getTime() < range.to.getTime() ? clampedToday : range.to,
  };

  return categories.flatMap((category) => {
    const group = categoryGroupKey(category);
    if (group === null) return [];
    const categoryTransactions = transactions.filter((t) => t.categoryId === category.id);
    const { speseEffettive } = computeSummary(categoryTransactions, elapsedRange);
    return [
      {
        categoryId: category.id,
        name: category.name,
        group,
        amount: speseEffettive,
        color: category.color,
        icon: category.icon,
      },
    ];
  });
}

export type GroupTotals = Record<CategoryGroupKey, number>;

/** Somma la spesa effettiva del periodo per gruppo di spesa (Dovute/Volute/Te futuro/Saltuarie) più "daCategorizzare". */
export function computeGroupTotals(
  transactions: Transaction[],
  categories: Category[],
  period: ExpensePeriod,
  referenceDate: Date,
  today: Date
): GroupTotals {
  const totals = Object.fromEntries(
    [...EXPENSE_GROUP_KEYS, UNCATEGORIZED_GROUP_KEY].map((key) => [key, 0])
  ) as GroupTotals;
  for (const entry of computeCategoryBreakdown(transactions, categories, period, referenceDate, today)) {
    totals[entry.group] += entry.amount;
  }
  return totals;
}
```

- [ ] **Step 4: Aggiorna `category-breakdown-donut.utils.ts` e il suo test**

Righe 1-11 di `category-breakdown-donut.utils.ts`:

```ts
import type { CategoryAmount } from "@/lib/calc/expenses";
import { EXPENSE_GROUP_KEYS, UNCATEGORIZED_GROUP_KEY, type CategoryGroupKey } from "@/lib/categories/groups";

const GROUP_ORDER = Object.fromEntries(
  [...EXPENSE_GROUP_KEYS, UNCATEGORIZED_GROUP_KEY].map((key, index) => [key, index])
) as Record<CategoryGroupKey, number>;

/** Ordina le categorie per gruppo (Dovute → Volute → Te futuro → Saltuarie → Da categorizzare) e, dentro ogni gruppo, per importo decrescente. */
export function sortCategoryAmounts(categoryAmounts: CategoryAmount[]): CategoryAmount[] {
  return [...categoryAmounts].sort((a, b) => {
    if (a.group !== b.group) return GROUP_ORDER[a.group] - GROUP_ORDER[b.group];
    return b.amount - a.amount;
  });
}
```

In `category-breakdown-donut.utils.test.ts`: in `makeEntry` sostituisci `type: "voluta",` (già rinominato dal sed) con `group: "voluta",`; in tutto il file sostituisci le chiavi `type: "dovuta"` / `type: "voluta"` degli override con `group: ...`:

```bash
sed -i 's/type: "dovuta"/group: "dovuta"/g; s/type: "voluta"/group: "voluta"/g' components/domain/expenses/category-breakdown-donut.utils.test.ts
```

Poi sostituisci i primi due `it` di `describe("sortCategoryAmounts", ...)` con:

```ts
  it("ordina per gruppo: dovute, volute, te futuro, saltuarie, da categorizzare in coda", () => {
    const input = [
      makeEntry({ categoryId: "fb", group: "daCategorizzare", amount: 999 }),
      makeEntry({ categoryId: "sal", group: "saltuaria", amount: 10 }),
      makeEntry({ categoryId: "vol", group: "voluta", amount: 100 }),
      makeEntry({ categoryId: "fut", group: "futuro", amount: 5 }),
      makeEntry({ categoryId: "dov", group: "dovuta", amount: 1 }),
    ];
    expect(sortCategoryAmounts(input).map((e) => e.categoryId)).toEqual(["dov", "vol", "fut", "sal", "fb"]);
  });

  it("dentro lo stesso gruppo ordina per importo decrescente", () => {
    const input = [
      makeEntry({ categoryId: "d-low", group: "dovuta", amount: 10 }),
      makeEntry({ categoryId: "d-high", group: "dovuta", amount: 50 }),
    ];
    expect(sortCategoryAmounts(input).map((e) => e.categoryId)).toEqual(["d-high", "d-low"]);
  });
```

- [ ] **Step 5: Verifica**

Run: `pnpm exec vitest run lib/calc/expenses.test.ts components/domain/expenses/category-breakdown-donut.utils.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/calc/expenses.ts lib/calc/expenses.test.ts components/domain/expenses/category-breakdown-donut.utils.ts components/domain/expenses/category-breakdown-donut.utils.test.ts
git commit -m "feat(transazioni): totali per gruppo di spesa e ordinamento torta per gruppo"
```

---

### Task 4: Cash flow — "Dove va ogni euro" per gruppo

**Files:**
- Modify: `lib/calc/cashflow.ts:240-291`
- Modify: `lib/calc/cashflow.test.ts` (blocco `describe("computeWhereItGoes", ...)`)
- Modify: `components/domain/cashflow/where-it-goes-breakdown.tsx`

**Interfaces:**
- Consumes: `EXPENSE_GROUP_KEYS`, `EXPENSE_GROUPS`, `GROUP_DISPLAY`, `categoryGroupKey`, `isExpenseGroup`, `ExpenseGroup` (Task 1).
- Produces: `WhereItGoesEntry = { key: ExpenseGroup | "nonClassificato" | "avanzo"; label: string; amount: number; quotaPct: number | null }`; `computeWhereItGoes` con firma invariata, 6 voci nell'ordine Dovute, Volute, Te futuro, Saltuarie, Non classificato, Avanzo.

- [ ] **Step 1: Riscrivi i test**

Sostituisci l'intero `describe("computeWhereItGoes", ...)` di `lib/calc/cashflow.test.ts` con (mantieni l'ultimo `it` sul post-"Dividi" adattandone solo le chiavi `"fisse"`→`"dovuta"`, `"risparmio"`→`"avanzo"`; il sed del Task 2 ha già reso `type: "dovuta"`):

```ts
describe("computeWhereItGoes", () => {
  it("restituisce le sei voci nell'ordine Dovute, Volute, Te futuro, Saltuarie, Non classificato, Avanzo", () => {
    const entries = computeWhereItGoes([], [], new Date(2026, 1, 15));
    expect(entries.map((e) => e.key)).toEqual(["dovuta", "voluta", "futuro", "saltuaria", "nonClassificato", "avanzo"]);
    expect(entries.map((e) => e.label)).toEqual(["Dovute", "Volute", "Te futuro", "Saltuarie", "Non classificato", "Avanzo"]);
  });

  it("somma per gruppo con quote sul totale entrate; Te futuro conta come spesa", () => {
    const categories = [
      makeCategory({ id: "cat-dov", type: "dovuta" }),
      makeCategory({ id: "cat-vol", type: "voluta" }),
      makeCategory({ id: "cat-fut", type: "futuro" }),
      makeCategory({ id: "cat-sal", type: "saltuaria" }),
    ];
    const transactions = [
      makeTransaction({ categoryId: "cat-dov", amount: "-400.00", date: "2026-02-05" }),
      makeTransaction({ categoryId: "cat-vol", amount: "-300.00", date: "2026-02-10" }),
      makeTransaction({ categoryId: "cat-fut", amount: "-200.00", date: "2026-02-11" }),
      makeTransaction({ categoryId: "cat-sal", amount: "-100.00", date: "2026-02-12" }),
      makeTransaction({ categoryId: "category-1", amount: "1500.00", date: "2026-02-01" }),
    ];

    const entries = computeWhereItGoes(transactions, categories, new Date(2026, 1, 15));
    const byKey = Object.fromEntries(entries.map((e) => [e.key, e]));

    expect(byKey.dovuta.amount).toBe(400);
    expect(byKey.dovuta.quotaPct).toBeCloseTo((400 / 1500) * 100);
    expect(byKey.voluta.amount).toBe(300);
    expect(byKey.futuro.amount).toBe(200);
    expect(byKey.saltuaria.amount).toBe(100);
    expect(byKey.avanzo.amount).toBe(500);
  });

  it("l'avanzo può essere negativo se si spende più di quanto entra", () => {
    const dovuta = makeCategory({ id: "cat-dov", type: "dovuta" });
    const transactions = [
      makeTransaction({ categoryId: "cat-dov", amount: "-2000.00", date: "2026-02-05" }),
      makeTransaction({ categoryId: "category-1", amount: "1500.00", date: "2026-02-01" }),
    ];
    const entries = computeWhereItGoes(transactions, [dovuta], new Date(2026, 1, 15));
    expect(entries.find((e) => e.key === "avanzo")?.amount).toBe(-500);
  });

  it("quotaPct è null quando le entrate del mese sono zero", () => {
    const dovuta = makeCategory({ id: "cat-dov", type: "dovuta" });
    const transactions = [makeTransaction({ categoryId: "cat-dov", amount: "-200.00", date: "2026-02-05" })];
    const entries = computeWhereItGoes(transactions, [dovuta], new Date(2026, 1, 15));
    expect(entries.every((e) => e.quotaPct === null)).toBe(true);
  });

  it("spese su fallback, su categoria sconosciuta o su categoria 'entrata' finiscono in Non classificato", () => {
    const categories = [
      makeCategory({ id: "cat-dov", type: "dovuta" }),
      makeCategory({ id: "cat-fb", type: "voluta", isFallback: true }),
      makeCategory({ id: "cat-in", type: "entrata" }),
    ];
    const transactions = [
      makeTransaction({ categoryId: "cat-dov", amount: "-400.00", date: "2026-02-05" }),
      makeTransaction({ categoryId: "cat-fb", amount: "-50.00", date: "2026-02-06" }),
      makeTransaction({ categoryId: "cat-sconosciuta", amount: "-100.00", date: "2026-02-06" }),
      makeTransaction({ categoryId: "cat-in", amount: "-30.00", date: "2026-02-07" }),
      makeTransaction({ categoryId: "cat-in", amount: "1500.00", date: "2026-02-01" }),
    ];
    const entries = computeWhereItGoes(transactions, categories, new Date(2026, 1, 15));
    const byKey = Object.fromEntries(entries.map((e) => [e.key, e]));
    expect(byKey.voluta.amount).toBe(0);
    expect(byKey.nonClassificato.amount).toBe(180);
    expect(byKey.avanzo.amount).toBe(920); // 1500 - 400 - 180
  });
```

(seguito dall'`it` post-"Dividi" esistente adattato, poi `});`)

- [ ] **Step 2: Verifica che falliscano**

Run: `pnpm exec vitest run lib/calc/cashflow.test.ts`
Expected: FAIL sulle nuove chiavi.

- [ ] **Step 3: Implementa in `lib/calc/cashflow.ts`**

Aggiungi import: `import { EXPENSE_GROUP_KEYS, EXPENSE_GROUPS, categoryGroupKey, isExpenseGroup, type ExpenseGroup } from "@/lib/categories/groups";`

Sostituisci `WhereItGoesEntry` e `computeWhereItGoes` (righe 240-291):

```ts
/** Riga di `computeWhereItGoes`: un gruppo di spesa, le spese non classificate o l'avanzo del mese. */
export interface WhereItGoesEntry {
  key: ExpenseGroup | "nonClassificato" | "avanzo";
  label: string;
  amount: number;
  /** null se le entrate del mese sono zero (non calcolabile). L'avanzo può essere negativo (nessun floor a zero). */
  quotaPct: number | null;
}

/**
 * "Dove va ogni euro" del mese di riferimento: spesa per ciascun gruppo (Dovute, Volute, Te futuro,
 * Saltuarie — Te futuro conta come spesa), spese non classificabili (categoria fallback, assente
 * dall'array o erroneamente "entrata") e avanzo (entrate − tutte le uscite), con quota % sul totale
 * entrate. Entrate e uscite contano l'importo effettivo post-"Dividi" (`effectiveAmount`).
 */
export function computeWhereItGoes(
  transactions: Transaction[],
  categories: Category[],
  referenceDate: Date
): WhereItGoesEntry[] {
  const monthRange: DateRange = { from: startOfMonth(referenceDate), to: endOfMonth(referenceDate) };
  const inMonth = transactions.filter((t) => isWithinRange(parseDateOnly(t.date), monthRange));
  const categoryById = new Map(categories.map((c) => [c.id, c] as const));

  const entrate = inMonth.filter(isIncome).reduce((sum, t) => sum + effectiveAmount(t), 0);

  const groupTotals = Object.fromEntries(EXPENSE_GROUP_KEYS.map((key) => [key, 0])) as Record<ExpenseGroup, number>;
  let nonClassificato = 0;
  for (const t of inMonth.filter(isExpense)) {
    const category = categoryById.get(t.categoryId);
    const group = category ? categoryGroupKey(category) : null;
    const amount = Math.abs(effectiveAmount(t));
    if (group !== null && isExpenseGroup(group)) groupTotals[group] += amount;
    else nonClassificato += amount;
  }
  const totaleUscite = EXPENSE_GROUP_KEYS.reduce((sum, key) => sum + groupTotals[key], 0) + nonClassificato;

  const quotaOf = (amount: number) => (entrate > 0 ? (amount / entrate) * 100 : null);
  return [
    ...EXPENSE_GROUP_KEYS.map((key) => ({
      key,
      label: EXPENSE_GROUPS[key].label,
      amount: groupTotals[key],
      quotaPct: quotaOf(groupTotals[key]),
    })),
    { key: "nonClassificato", label: "Non classificato", amount: nonClassificato, quotaPct: quotaOf(nonClassificato) },
    { key: "avanzo", label: "Avanzo", amount: entrate - totaleUscite, quotaPct: quotaOf(entrate - totaleUscite) },
  ];
}
```

- [ ] **Step 4: Aggiorna `where-it-goes-breakdown.tsx`**

Sostituisci il file:

```tsx
/** Blocco "Dove va ogni euro" (mese corrente): una riga per ciascuna voce di `computeWhereItGoes` (gruppi di spesa, non classificato, avanzo) con pallino colore del gruppo, importo e quota % sulle entrate del mese — nessuna assunzione sul numero di voci. */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { GROUP_DISPLAY, isExpenseGroup } from "@/lib/categories/groups";
import type { WhereItGoesEntry } from "@/lib/calc/cashflow";

export interface WhereItGoesBreakdownProps {
  entries: WhereItGoesEntry[];
  currency: string;
}

export function WhereItGoesBreakdown({ entries, currency }: WhereItGoesBreakdownProps) {
  return (
    <Card className="p-0">
      <CardHeader className="pt-4">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Dove va ogni euro
        </CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border p-0">
        {entries.map((entry) => (
          <div key={entry.key} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={cn(
                  "size-2.5 shrink-0 rounded-full",
                  isExpenseGroup(entry.key) ? GROUP_DISPLAY[entry.key].dotClassName : "bg-transparent"
                )}
              />
              <p className="text-sm font-medium text-foreground">{entry.label}</p>
            </div>
            <div className="text-right">
              <p
                className={cn(
                  "text-sm font-medium tabular-nums",
                  entry.key === "avanzo" && entry.amount < 0 ? "text-neg" : "text-foreground"
                )}
              >
                {formatCurrency(entry.amount, currency)}
              </p>
              <p className="text-xs text-muted-foreground">
                {entry.quotaPct === null ? "—" : `${Math.round(entry.quotaPct)}%`}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Verifica**

Run: `pnpm exec vitest run lib/calc/cashflow.test.ts`
Expected: PASS.
Run: `pnpm exec tsc --noEmit` — nessun errore in `lib/calc/cashflow*.ts` né in `where-it-goes-breakdown.tsx`.

- [ ] **Step 6: Commit**

```bash
git add lib/calc/cashflow.ts lib/calc/cashflow.test.ts components/domain/cashflow/where-it-goes-breakdown.tsx
git commit -m "feat(cash-flow): 'Dove va ogni euro' per gruppo di spesa, Risparmio rinominato Avanzo"
```

---

### Task 5: Torta "Per categoria" in Transazioni

**Files:**
- Modify: `components/domain/expenses/category-breakdown-donut.tsx`
- Modify: `app/(app)/transazioni/page.tsx:35,251`

**Interfaces:**
- Consumes: `GroupTotals`, `computeGroupTotals`, `CategoryAmount.group` (Task 3); `EXPENSE_GROUP_KEYS`, `GROUP_DISPLAY`, `UNCATEGORIZED_GROUP_KEY` (Task 1).
- Produces: `CategoryBreakdownDonutProps` con `groupTotals: GroupTotals` al posto di `fixedVsVariable`.

- [ ] **Step 1: Aggiorna il componente**

In `category-breakdown-donut.tsx`:

1. JSDoc in testa: `(layer interno tipo fissa/variabile, layer esterno categoria)` → `(layer interno gruppo di spesa — Dovute/Volute/Te futuro/Saltuarie più "Da categorizzare" se presente —, layer esterno categoria)`; rimuovi la frase `Unifica il vecchio donut "Fisse vs variabili" e la lista budget separata in un'unica card.` sostituendola con `Unifica torta per gruppo e lista budget in un'unica card.`
2. Import: `import type { CategoryAmount, FixedVsVariable } from "@/lib/calc/expenses";` → `import type { CategoryAmount, GroupTotals } from "@/lib/calc/expenses";` e aggiungi
   `import { EXPENSE_GROUP_KEYS, GROUP_DISPLAY, UNCATEGORIZED_GROUP_KEY, type CategoryGroupKey } from "@/lib/categories/groups";`
3. Sostituisci `TYPE_CONFIG` con:

```ts
const GROUP_CHART_CONFIG = Object.fromEntries(
  [...EXPENSE_GROUP_KEYS, UNCATEGORIZED_GROUP_KEY].map((key) => [
    key,
    { label: GROUP_DISPLAY[key].label, color: GROUP_DISPLAY[key].colorVar },
  ])
) satisfies ChartConfig;
```

4. Props: `fixedVsVariable: FixedVsVariable;` → `groupTotals: GroupTotals;` e nella destrutturazione `fixedVsVariable,` → `groupTotals,`.
5. Sostituisci `innerData` con:

```ts
  const innerKeys: CategoryGroupKey[] = [
    ...EXPENSE_GROUP_KEYS,
    ...(groupTotals.daCategorizzare > 0 ? [UNCATEGORIZED_GROUP_KEY] : []),
  ];
  const innerData = innerKeys.map((key) => ({
    key,
    label: GROUP_DISPLAY[key].label,
    value: groupTotals[key],
    fill: GROUP_DISPLAY[key].colorVar,
  }));
```

6. `<ChartContainer config={TYPE_CONFIG} ...>` → `config={GROUP_CHART_CONFIG}`.
7. In `CategoryLegendRow`, nel `<div className="flex items-center gap-3">`, prima di `<CategoryAvatar`, aggiungi il pallino gruppo:

```tsx
        <span
          aria-hidden="true"
          title={GROUP_DISPLAY[entry.group].label}
          className={cn("size-2 shrink-0 rounded-full", GROUP_DISPLAY[entry.group].dotClassName)}
        />
```

e sotto il nome, nella riga `{formatCurrency(entry.amount, currency)} speso`, rendi il gruppo leggibile anche agli screen reader:
`{formatCurrency(entry.amount, currency)} speso · {GROUP_DISPLAY[entry.group].label}`.

- [ ] **Step 2: Aggiorna la pagina Transazioni**

In `app/(app)/transazioni/page.tsx`: nell'import da `@/lib/calc/expenses`, `computeFixedVsVariable,` → `computeGroupTotals,`; alla riga ~251:

```tsx
            groupTotals={computeGroupTotals(expenseTransactionsForAnalysis, safeCategories, period, referenceDate, today)}
```

- [ ] **Step 3: Verifica**

Run: `pnpm exec tsc --noEmit`
Expected: errori residui solo in `components/domain/categories/category-row.tsx` e `add-category-form.tsx` (Task 6).
Run: `pnpm exec vitest run components/domain/expenses lib/calc`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/domain/expenses/category-breakdown-donut.tsx "app/(app)/transazioni/page.tsx"
git commit -m "feat(transazioni): anello interno della torta per gruppo di spesa, pallino gruppo in legenda"
```

---

### Task 6: Pagina `/categorie` divisa per gruppi

**Files:**
- Create: `components/domain/categories/category-type-select.tsx`
- Create: `components/domain/categories/category-section.tsx`
- Modify: `components/domain/categories/category-row.tsx`
- Modify: `components/domain/categories/add-category-form.tsx`
- Modify: `components/domain/categories/index.ts`
- Modify: `app/(app)/categorie/page.tsx`

**Interfaces:**
- Consumes: `CATEGORY_TYPES`, `CATEGORY_TYPE_LABELS`, `CategoryType`, `DEFAULT_NEW_CATEGORY_TYPE`, `groupCategoriesByType`, `EXPENSE_GROUPS`, `GROUP_DISPLAY` (Task 1).
- Produces:
  - `CategoryTypeSelect({ value: CategoryType; onChange: (next: CategoryType) => void; size?: "sm" | "default"; className?: string })`
  - `CategorySection({ title: string; description?: string; dotClassName?: string; children: React.ReactNode })`

- [ ] **Step 1: Crea `category-type-select.tsx`**

```tsx
"use client";

/** Select del tipo categoria (quattro gruppi di spesa + Entrata), condiviso da riga categoria e form di creazione. */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORY_TYPES, CATEGORY_TYPE_LABELS, type CategoryType } from "@/lib/categories/groups";

export interface CategoryTypeSelectProps {
  value: CategoryType;
  onChange: (next: CategoryType) => void;
  size?: "sm" | "default";
  className?: string;
  "aria-label"?: string;
}

export function CategoryTypeSelect({ value, onChange, size = "default", className, ...rest }: CategoryTypeSelectProps) {
  return (
    <Select value={value} onValueChange={(next) => next && onChange(next as CategoryType)}>
      <SelectTrigger size={size} className={className} aria-label={rest["aria-label"] ?? "Tipo categoria"}>
        <SelectValue>{(current: CategoryType) => CATEGORY_TYPE_LABELS[current]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {CATEGORY_TYPES.map((type) => (
          <SelectItem key={type} value={type}>
            {CATEGORY_TYPE_LABELS[type]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

- [ ] **Step 2: Crea `category-section.tsx`**

```tsx
/** Sezione della pagina Categorie: intestazione (pallino colore gruppo, titolo, descrizione breve) e righe categoria. */

import * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface CategorySectionProps {
  title: string;
  description?: string;
  /** Classe Tailwind del pallino colore; omessa per sezioni senza gruppo (es. Entrate). */
  dotClassName?: string;
  children: React.ReactNode;
}

export function CategorySection({ title, description, dotClassName, children }: CategorySectionProps) {
  return (
    <section className="flex flex-col gap-2">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {dotClassName && <span aria-hidden="true" className={cn("size-2.5 rounded-full", dotClassName)} />}
          {title}
        </h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Card className="p-0">{children}</Card>
    </section>
  );
}
```

- [ ] **Step 3: Usa `CategoryTypeSelect` in `category-row.tsx` e `add-category-form.tsx`**

`category-row.tsx`:
- rimuovi la costante `TYPE_LABELS` e l'import di `Select*` (non più usato);
- aggiungi `import { CategoryTypeSelect } from "./category-type-select";` e `import type { CategoryType } from "@/lib/categories/groups";`
- `commitType` diventa:

```ts
  function commitType(type: CategoryType) {
    if (type === category.type) return;
    updateMutation.mutate({ id: category.id, input: { type } });
  }
```

- sostituisci l'intero blocco `<Select value={category.type} ...>...</Select>` con:

```tsx
          <CategoryTypeSelect value={category.type} onChange={commitType} size="sm" className="h-6 w-fit text-xs" />
```

`add-category-form.tsx`:
- rimuovi `TYPE_LABELS` e l'import `Select*`;
- import: `import { CategoryTypeSelect } from "./category-type-select";` e `import { DEFAULT_NEW_CATEGORY_TYPE, type CategoryType } from "@/lib/categories/groups";`
- `useState<"fissa" | "variabile" | "entrata">("variabile")` → `useState<CategoryType>(DEFAULT_NEW_CATEGORY_TYPE)`; `setType("variabile")` → `setType(DEFAULT_NEW_CATEGORY_TYPE)`;
- sostituisci il blocco `<Select ...>...</Select>` con `<CategoryTypeSelect value={type} onChange={setType} className="w-36" />`.

- [ ] **Step 4: Barrel**

In `components/domain/categories/index.ts` aggiungi:

```ts
export { CategoryTypeSelect } from "./category-type-select";
export type { CategoryTypeSelectProps } from "./category-type-select";
export { CategorySection } from "./category-section";
export type { CategorySectionProps } from "./category-section";
```

- [ ] **Step 5: Pagina `/categorie`**

In `app/(app)/categorie/page.tsx`: import `CategorySection` dal barrel e `import { EXPENSE_GROUPS, GROUP_DISPLAY, groupCategoriesByType } from "@/lib/categories/groups";`. Sottotitolo: `Categorie di spesa e di entrata: nome, tipo, icona e colore.` → `Le spese sono divise in quattro gruppi: Dovute, Volute, Te futuro e Saltuarie.` Sostituisci il ramo `: ( <Card className="p-0"> ... </Card> )` con:

```tsx
      ) : (
        (() => {
          const sections = groupCategoriesByType(safeCategories);
          return (
            <div className="flex flex-col gap-5">
              {sections.groups.map((group) => (
                <CategorySection
                  key={group.key}
                  title={EXPENSE_GROUPS[group.key].label}
                  description={EXPENSE_GROUPS[group.key].shortDescription}
                  dotClassName={EXPENSE_GROUPS[group.key].dotClassName}
                >
                  {group.categories.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-muted-foreground">Nessuna categoria in questo gruppo.</p>
                  ) : (
                    group.categories.map((category) => <CategoryRow key={category.id} category={category} />)
                  )}
                </CategorySection>
              ))}
              {sections.uncategorized.length > 0 && (
                <CategorySection
                  title={GROUP_DISPLAY.daCategorizzare.label}
                  description="Movimenti non ancora assegnati a una categoria."
                  dotClassName={GROUP_DISPLAY.daCategorizzare.dotClassName}
                >
                  {sections.uncategorized.map((category) => <CategoryRow key={category.id} category={category} />)}
                </CategorySection>
              )}
              <CategorySection title="Entrate">
                {sections.income.map((category) => <CategoryRow key={category.id} category={category} />)}
              </CategorySection>
              <CategorySection title="Nuova categoria">
                <AddCategoryForm />
              </CategorySection>
            </div>
          );
        })()
      )}
```

Rimuovi l'import di `Card` se non più usato. (Se ESLint segnala l'IIFE, estrai il blocco in un componente locale `CategorySections({ categories })` nello stesso file — la pagina resta pura orchestrazione.)

- [ ] **Step 6: Verifica**

Run: `pnpm exec tsc --noEmit`
Expected: **nessun errore**.
Run: `pnpm lint`
Expected: soli i 2 errori noti.
Run: `pnpm exec vitest run`
Expected: PASS salvo i 3 noti di `scheduler.test.ts`.

- [ ] **Step 7: Commit**

```bash
git add components/domain/categories "app/(app)/categorie/page.tsx"
git commit -m "feat(categorie): pagina divisa per gruppi di spesa, select tipo condiviso"
```

---

### Task 7: Script di reset categorie

**Files:**
- Create: `lib/db/reset-categories.ts`
- Create: `lib/db/reset-categories.test.ts`
- Modify: `package.json` (script)
- Modify: `lib/db/backfill-category-appearance.ts` (solo JSDoc)

**Interfaces:**
- Consumes: `DEFAULT_CATEGORIES`, `LEGACY_CATEGORY_NAMES` (Task 2); `getFallbackCategoryId` (`lib/categorization/fallback.ts`); tabelle `categories`, `transactions`, `budgets`, `categorizationRules`.
- Produces: `planCategoryReset(existing, defaults, legacyNames): CategoryResetPlan`; `resetUserCategories(userId, { dryRun }): Promise<CategoryResetSummary>`.

- [ ] **Step 1: Scrivi i test del planner**

`lib/db/reset-categories.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { planCategoryReset, type ExistingCategory, type ResetDefault } from "./reset-categories";

const DEFAULTS: ResetDefault[] = [
  { name: "Affitto & Mutuo", type: "dovuta", icon: "home", color: "slate" },
  { name: "Salute & Farmaci", type: "dovuta", icon: "pill", color: "rose" },
  { name: "Abbonamenti", type: "voluta", icon: "tv", color: "purple" },
  { name: "Da categorizzare", type: "voluta", icon: "help-circle", color: "red", isFallback: true },
];
const LEGACY = { "Salute & Cura": "Salute & Farmaci" };

function existing(id: string, name: string, type = "dovuta", isFallback = false): ExistingCategory {
  return { id, name, type, icon: "package", color: "slate", isFallback };
}

describe("planCategoryReset", () => {
  it("aggiorna per nome esatto preservando l'id", () => {
    const plan = planCategoryReset([existing("a", "Abbonamenti", "dovuta")], DEFAULTS, LEGACY);
    expect(plan.updates).toContainEqual({ id: "a", name: "Abbonamenti", type: "voluta", icon: "tv", color: "purple" });
  });

  it("aggiorna una categoria col nome legacy rinominandola", () => {
    const plan = planCategoryReset([existing("s", "Salute & Cura", "voluta")], DEFAULTS, LEGACY);
    expect(plan.updates).toContainEqual({ id: "s", name: "Salute & Farmaci", type: "dovuta", icon: "pill", color: "rose" });
    expect(plan.deletions).toEqual([]);
  });

  it("se esistono sia il nome esatto sia il legacy, vince l'esatto e la legacy va eliminata", () => {
    const plan = planCategoryReset(
      [existing("legacy", "Salute & Cura"), existing("exact", "Salute & Farmaci")],
      DEFAULTS,
      LEGACY
    );
    expect(plan.updates.map((u) => u.id)).toContain("exact");
    expect(plan.updates.map((u) => u.id)).not.toContain("legacy");
    expect(plan.deletions).toEqual(["legacy"]);
  });

  it("crea le categorie di default mancanti (mai la fallback)", () => {
    const plan = planCategoryReset([], DEFAULTS, LEGACY);
    expect(plan.creates.map((c) => c.name)).toEqual(["Affitto & Mutuo", "Salute & Farmaci", "Abbonamenti"]);
  });

  it("elimina le categorie personalizzate e non tocca mai la fallback", () => {
    const plan = planCategoryReset(
      [existing("custom", "Palestra"), existing("fb", "Da categorizzare", "voluta", true)],
      DEFAULTS,
      LEGACY
    );
    expect(plan.deletions).toEqual(["custom"]);
    expect(plan.updates.map((u) => u.id)).not.toContain("fb");
  });

  it("su uno stato già resettato non produce azioni", () => {
    const already: ExistingCategory[] = DEFAULTS.map((d, index) => ({
      id: `id-${index}`,
      name: d.name,
      type: d.type,
      icon: d.icon,
      color: d.color,
      isFallback: d.isFallback ?? false,
    }));
    const plan = planCategoryReset(already, DEFAULTS, LEGACY);
    expect(plan).toEqual({ updates: [], creates: [], deletions: [] });
  });
});
```

- [ ] **Step 2: Verifica che falliscano**

Run: `pnpm exec vitest run lib/db/reset-categories.test.ts`
Expected: FAIL (modulo inesistente).

- [ ] **Step 3: Implementa `lib/db/reset-categories.ts`**

```ts
/**
 * Reset one-shot delle categorie di ogni utente alla lista DEFAULT_CATEGORIES a gruppi di spesa
 * (spec 2026-09-22-categorie-gruppi-spesa). Le categorie di default (anche con nome legacy) vengono
 * aggiornate preservandone l'id; le altre (personalizzate incluse) eliminate con transazioni spostate
 * sulla fallback e budget/regole rimossi. Idempotente. Richiede l'enum già migrato
 * (`pnpm db:migrate-category-groups`). Esecuzione: `pnpm db:reset-categories [--dry-run]`.
 */
import { and, eq, inArray } from "drizzle-orm";
import { db } from "./client";
import { categories, DEFAULT_CATEGORIES, LEGACY_CATEGORY_NAMES } from "./schema/categories";
import { transactions } from "./schema/transactions";
import { budgets } from "./schema/budgets";
import { categorizationRules } from "./schema/categorization-rules";
import { getFallbackCategoryId } from "@/lib/categorization/fallback";
import type { CategoryType } from "@/lib/categories/groups";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";

export interface ExistingCategory {
  id: string;
  name: string;
  type: string;
  icon: string;
  color: string;
  isFallback: boolean;
}

export interface ResetDefault {
  name: string;
  type: CategoryType;
  icon: CategoryIcon;
  color: CategoryColor;
  isFallback?: boolean;
}

export interface CategoryUpdate {
  id: string;
  name: string;
  type: CategoryType;
  icon: CategoryIcon;
  color: CategoryColor;
}

export interface CategoryResetPlan {
  updates: CategoryUpdate[];
  creates: ResetDefault[];
  /** Id di categorie non-fallback da eliminare. */
  deletions: string[];
}

/** Decide, senza toccare il DB, come portare le categorie di un utente alla lista di default. */
export function planCategoryReset(
  existing: ExistingCategory[],
  defaults: ResetDefault[],
  legacyNames: Record<string, string>
): CategoryResetPlan {
  const candidates = existing.filter((category) => !category.isFallback);
  const claimed = new Set<string>();
  const plan: CategoryResetPlan = { updates: [], creates: [], deletions: [] };

  for (const target of defaults.filter((d) => !d.isFallback)) {
    const match =
      candidates.find((c) => !claimed.has(c.id) && c.name === target.name) ??
      candidates.find((c) => !claimed.has(c.id) && legacyNames[c.name] === target.name);
    if (!match) {
      plan.creates.push(target);
      continue;
    }
    claimed.add(match.id);
    const unchanged =
      match.name === target.name && match.type === target.type && match.icon === target.icon && match.color === target.color;
    if (!unchanged) {
      plan.updates.push({ id: match.id, name: target.name, type: target.type, icon: target.icon, color: target.color });
    }
  }

  plan.deletions = candidates.filter((c) => !claimed.has(c.id)).map((c) => c.id);
  return plan;
}

export interface CategoryResetSummary {
  updated: number;
  created: number;
  deleted: number;
  reassignedTransactions: number;
}

/**
 * Applica il piano di reset per un utente in un'unica transazione. Ordine: riassegna le transazioni delle
 * categorie da eliminare alla fallback, elimina budget e regole, elimina le categorie (liberando i nomi),
 * poi aggiorna e crea. Con `dryRun` calcola solo il riepilogo.
 */
export async function resetUserCategories(userId: string, { dryRun }: { dryRun: boolean }): Promise<CategoryResetSummary> {
  const fallbackId = dryRun ? null : await getFallbackCategoryId(userId);
  const existing = await db.select().from(categories).where(eq(categories.userId, userId));
  const plan = planCategoryReset(existing, DEFAULT_CATEGORIES, LEGACY_CATEGORY_NAMES);

  const affected =
    plan.deletions.length === 0
      ? []
      : await db
          .select({ id: transactions.id })
          .from(transactions)
          .where(and(eq(transactions.userId, userId), inArray(transactions.categoryId, plan.deletions)));

  const summary: CategoryResetSummary = {
    updated: plan.updates.length,
    created: plan.creates.length,
    deleted: plan.deletions.length,
    reassignedTransactions: affected.length,
  };
  if (dryRun || fallbackId === null) return summary;

  await db.transaction(async (tx) => {
    if (plan.deletions.length > 0) {
      await tx
        .update(transactions)
        .set({ categoryId: fallbackId })
        .where(and(eq(transactions.userId, userId), inArray(transactions.categoryId, plan.deletions)));
      await tx.delete(budgets).where(inArray(budgets.categoryId, plan.deletions));
      await tx.delete(categorizationRules).where(inArray(categorizationRules.categoryId, plan.deletions));
      await tx.delete(categories).where(inArray(categories.id, plan.deletions));
    }
    for (const update of plan.updates) {
      const { id, ...fields } = update;
      await tx.update(categories).set(fields).where(eq(categories.id, id));
    }
    if (plan.creates.length > 0) {
      await tx.insert(categories).values(
        plan.creates.map((category) => ({
          userId,
          name: category.name,
          type: category.type,
          icon: category.icon,
          color: category.color,
        }))
      );
    }
  });

  return summary;
}

/** Esecuzione da riga di comando su tutti gli utenti che hanno almeno una categoria. */
async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const users = await db.selectDistinct({ userId: categories.userId }).from(categories);
  console.log(dryRun ? "DRY RUN — nessuna scrittura" : "Reset categorie in corso");
  for (const { userId } of users) {
    const s = await resetUserCategories(userId, { dryRun });
    console.log(
      `utente ${userId}: ${s.updated} aggiornate, ${s.created} create, ${s.deleted} eliminate, ${s.reassignedTransactions} transazioni → "Da categorizzare"`
    );
  }
  process.exit(0);
}

if (process.argv[1]?.includes("reset-categories")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
```

Nota: se un'update rinomina una categoria legacy in un nome oggi occupato da una categoria da eliminare, l'ordine "prima eliminazioni poi update" evita la violazione del vincolo unique `(user_id, name)` — il planner garantisce che il nome esatto, se esiste, sia sempre quello scelto (quindi il caso "nome occupato da una non eliminata" non può verificarsi).

- [ ] **Step 4: Script e JSDoc**

`package.json`, dopo `db:migrate-category-groups`:

```json
    "db:reset-categories": "tsx --env-file=.env.local lib/db/reset-categories.ts",
```

`lib/db/backfill-category-appearance.ts`: aggiungi in fondo al JSDoc di testa la riga
` * Obsoleto dopo il reset categorie a gruppi di spesa (lib/db/reset-categories.ts, 2026-09-22): conservato solo come storico.`

- [ ] **Step 5: Verifica**

Run: `pnpm exec vitest run lib/db/reset-categories.test.ts`
Expected: PASS (6 test).
Run: `pnpm exec tsc --noEmit` → nessun errore.

- [ ] **Step 6: Commit**

```bash
git add lib/db/reset-categories.ts lib/db/reset-categories.test.ts package.json lib/db/backfill-category-appearance.ts
git commit -m "feat(categorie): script di reset categorie ai nuovi default a gruppi"
```

- [ ] **Step 7: Esecuzione — STOP, la esegue l'utente**

Chiedi all'utente di eseguire dal worktree, prima `pnpm db:reset-categories --dry-run` (controllare il riepilogo per utente), poi `pnpm db:reset-categories`. Una seconda esecuzione deve stampare `0 aggiornate, 0 create, 0 eliminate` per ogni utente.

---

### Task 8: Documentazione e verifica finale

**Files:**
- Modify: `docs/functional-spec.md` (sezioni Spese/Transazioni e Cash flow)
- Modify: `CLAUDE.md` ("Stato del progetto" + voce di log)

**Interfaces:**
- Consumes: tutto quanto sopra. Produces: nulla.

- [ ] **Step 1: `docs/functional-spec.md`**

Cerca le occorrenze di "fisse", "variabili", "Fisse vs variabili", "Risparmio" nelle sezioni Spese e Cash flow (`grep -n -i "fiss\|variabil\|risparmio" docs/functional-spec.md`) e aggiornale: le categorie di spesa appartengono a uno di quattro gruppi (Dovute, Volute, Te futuro, Saltuarie — con la definizione breve di ciascuno); la torta di Transazioni ha l'anello interno per gruppo (più "Da categorizzare"); "Dove va ogni euro" in Cash flow ha le voci Dovute, Volute, Te futuro, Saltuarie, Non classificato, Avanzo, e "Te futuro" conta come spesa.

- [ ] **Step 2: `CLAUDE.md`**

In "Stato del progetto" aggiungi il completamento del piano `docs/superpowers/plans/2026-09-22-categorie-gruppi-spesa.md` con la verifica manuale utente da fare (dalla spec, sezione "Verifica manuale utente"). Nel "Log delle decisioni" aggiungi in cima una voce **2026-09-22** con: decisioni del brainstorming (Te futuro = spesa, Saltuarie solo raggruppamento, reset categorie, etichette brevi, enum sostituito), script `db:migrate-category-groups` + `db:reset-categories`, rinomina "Risparmio"→"Avanzo" in Cash flow, fallback fuori dai gruppi, fuori scope (budget per gruppo, filtro per gruppo, accantonamento Saltuarie).

- [ ] **Step 3: Verifica finale**

```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm exec vitest run
grep -rn --include=*.ts --include=*.tsx -e '"fissa"' -e '"variabile"' -e "'fissa'" -e "'variabile'" app components lib
```

Expected: `tsc` pulito; lint con soli i 2 errori noti; vitest verde salvo i 3 noti di `scheduler.test.ts`; il `grep` restituisce solo le righe di `lib/db/migrate-category-groups.ts` e del suo test (i valori legacy che lo script migra).

- [ ] **Step 4: Commit**

```bash
git add docs/functional-spec.md CLAUDE.md
git commit -m "docs: gruppi di spesa categorie in functional-spec e CLAUDE.md"
```
