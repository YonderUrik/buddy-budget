# Spending groups for categories — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `fissa`/`variabile` (fixed/variable) category types with four spending groups (Dovute, Volute, Te futuro, Saltuarie — roughly "Must-haves", "Wants", "Future you", "Occasional") in the DB, the default categories, the statistics (Transazioni donut, "Dove va ogni euro" ("Where every euro goes") in Cash flow) and the `/categorie` page, plus a script that resets existing categories.

**Architecture:** A pure module `lib/categories/groups.ts` is the single source of truth for the groups' types, order, labels and colors; everything else imports it instead of repeating literal unions. The Postgres enum `category_type` is renamed/extended by an idempotent script; a second script brings every user's categories back to the new default list, with the decision logic in a tested pure function.

**Tech Stack:** Next.js App Router, TypeScript, Drizzle ORM + postgres-js, Zod, TanStack Query, Recharts (via shadcn `Chart`), Tailwind v4 tokens, vitest, pnpm, tsx.

**Spec:** `docs/superpowers/specs/2026-09-22-categorie-gruppi-spesa-design.md`

## Global Constraints

- `category_type` enum values, in this order: `dovuta`, `voluta`, `futuro`, `saltuaria`, `entrata`.
- UI labels: `Dovute`, `Volute`, `Te futuro`, `Saltuarie`; income: `Entrata`; fallback: `Da categorizzare`.
- "Te futuro" counts as normal spending everywhere (no total changes).
- The fallback category (`isFallback: true`) is never classified by `type`: in the statistics it goes into the "Da categorizzare" / "Non classificato" ("To categorize" / "Unclassified") bucket. Its `type` in the DB is `voluta`.
- No hex colors in components: only tokens (`--group-*`) defined in `app/globals.css` for `:root` and `.dark`.
- No literal union `"fissa" | "variabile" | ...` or `"dovuta" | ...` outside `lib/categories/groups.ts`: use `CategoryType` / `ExpenseGroup` / `CategoryGroupKey`.
- One-line JSDoc on every new or modified public function/component.
- All UI strings in Italian.
- Test commands: `pnpm exec vitest run <path>`; types: `pnpm exec tsc --noEmit`; lint: `pnpm lint`.
- Known, unrelated failures to ignore: 3 tests in `lib/gocardless/scheduler.test.ts`; 2 lint errors `react-hooks/set-state-in-effect` in `components/theme-toggle.tsx` and `CategoryLegendRow`.
- **Shared DB**: many API tests (`app/api/**/route.test.ts`) use the real Postgres. The enum migration script (Task 2) must be run **by the user** before running those tests; do not run `ALTER TYPE`/`db:push` on your own initiative.
- Git: only `add`/`commit` in the assigned worktree; no `fetch`/`reset`/`merge`/`push`.

## Review Focus

1. **Custom category with transactions at reset** → the transactions must end up on "Da categorizzare", not be lost nor make the FK fail (test in Task 7 on `planCategoryReset` + order of operations in `resetUserCategories`).
2. **User who has both the legacy name and the new name** (e.g. "Salute & Cura" and "Salute & Farmaci") → the exact name wins, the legacy one must be deleted, no violation of the unique constraint `(user_id, name)` (test in Task 7).
3. **Spending on the fallback** → never counted in a group: grey "Da categorizzare" slice in the donut, "Non classificato" in Cash flow (tests in Task 3 and Task 4).
4. **Scripts run twice** → enum migration and reset are no-ops on the second run (test of the "already reset" plan in Task 7; the migration reads `pg_enum` before acting, Task 2).
5. **Donut with "Da categorizzare" > 0** → outer ring sorted with the fallback last, aligned with the inner ring (test of `sortCategoryAmounts` in Task 3).

---

### Task 1: Groups module + color tokens

**Files:**
- Create: `lib/categories/groups.ts`
- Create: `lib/categories/groups.test.ts`
- Modify: `app/globals.css` (`@theme inline` block, `:root`, `.dark`)

**Interfaces:**
- Consumes: nothing.
- Produces (used by all following tasks):
  - `CATEGORY_TYPES: readonly ["dovuta","voluta","futuro","saltuaria","entrata"]`, `type CategoryType`
  - `EXPENSE_GROUP_KEYS: readonly ["dovuta","voluta","futuro","saltuaria"]`, `type ExpenseGroup`
  - `UNCATEGORIZED_GROUP_KEY = "daCategorizzare"`, `type CategoryGroupKey = ExpenseGroup | "daCategorizzare"`
  - `EXPENSE_GROUPS: Record<ExpenseGroup, ExpenseGroupInfo>` with `{ label, shortDescription, colorVar, dotClassName }`
  - `GROUP_DISPLAY: Record<CategoryGroupKey, GroupDisplay>` with `{ label, colorVar, dotClassName }`
  - `CATEGORY_TYPE_LABELS: Record<CategoryType, string>`
  - `DEFAULT_NEW_CATEGORY_TYPE: CategoryType` (= `"voluta"`)
  - `isExpenseGroup(type: string): type is ExpenseGroup`
  - `categoryGroupKey(category: { type: string; isFallback: boolean }): CategoryGroupKey | null` (null = income)
  - `groupCategoriesByType<T extends { type: string; isFallback: boolean }>(categories: T[]): CategorySections<T>`
    with `CategorySections<T> = { groups: { key: ExpenseGroup; categories: T[] }[]; uncategorized: T[]; income: T[] }`

- [ ] **Step 1: Write the tests**

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

- [ ] **Step 2: Verify that they fail**

Run: `pnpm exec vitest run lib/categories/groups.test.ts`
Expected: FAIL — `Failed to resolve import "./groups"`.

- [ ] **Step 3: Implement `lib/categories/groups.ts`**

```ts
/**
 * Spending groups of the categories (Dovute / Volute / Te futuro / Saltuarie) and the "entrata" (income) type: single source
 * of truth for values, order, labels and color tokens. Pure module, with no dependency on React or the DB.
 */

export const CATEGORY_TYPES = ["dovuta", "voluta", "futuro", "saltuaria", "entrata"] as const;
export type CategoryType = (typeof CATEGORY_TYPES)[number];

export const EXPENSE_GROUP_KEYS = ["dovuta", "voluta", "futuro", "saltuaria"] as const;
export type ExpenseGroup = (typeof EXPENSE_GROUP_KEYS)[number];

/** Statistical bucket for spending on the fallback category (or unclassifiable): it is not a category type. */
export const UNCATEGORIZED_GROUP_KEY = "daCategorizzare";
export type CategoryGroupKey = ExpenseGroup | typeof UNCATEGORIZED_GROUP_KEY;

export interface GroupDisplay {
  label: string;
  /** CSS token of the group color, to use as `fill` in charts. */
  colorVar: string;
  /** Literal Tailwind class for the color dot (literal for the JIT). */
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

/** Type proposed by default when the user creates a new category. */
export const DEFAULT_NEW_CATEGORY_TYPE: CategoryType = "voluta";

/** True if `type` is one of the four spending groups (excludes "entrata" and unknown values). */
export function isExpenseGroup(type: string): type is ExpenseGroup {
  return (EXPENSE_GROUP_KEYS as readonly string[]).includes(type);
}

/**
 * Statistical bucket of a category: the fallback and unknown types go to "daCategorizzare",
 * spending groups to themselves, income to `null` (it is not spending).
 */
export function categoryGroupKey(category: { type: string; isFallback: boolean }): CategoryGroupKey | null {
  if (category.isFallback) return UNCATEGORIZED_GROUP_KEY;
  if (category.type === "entrata") return null;
  return isExpenseGroup(category.type) ? category.type : UNCATEGORIZED_GROUP_KEY;
}

export interface CategorySections<T> {
  /** Always all four groups, in EXPENSE_GROUP_KEYS order, even when empty. */
  groups: { key: ExpenseGroup; categories: T[] }[];
  uncategorized: T[];
  income: T[];
}

/** Splits the categories into sections for the Categorie page, preserving the input order within each section. */
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

- [ ] **Step 4: Add the color tokens in `app/globals.css`**

In the `@theme inline` block, right after `--color-text-3: var(--text-3);`:

```css
  --color-group-dovuta: var(--group-dovuta);
  --color-group-voluta: var(--group-voluta);
  --color-group-futuro: var(--group-futuro);
  --color-group-saltuaria: var(--group-saltuaria);
  --color-group-uncategorized: var(--group-uncategorized);
```

In `:root`, right after `--chart-5: #b6c4bc;`:

```css
  --group-dovuta: #dc2626;
  --group-voluta: #d97706;
  --group-futuro: #16a34a;
  --group-saltuaria: #2563eb;
  --group-uncategorized: #94a3b8;
```

In `.dark`, right after `--chart-5: #2f4940;`:

```css
  --group-dovuta: #f87171;
  --group-voluta: #facc15;
  --group-futuro: #4ade80;
  --group-saltuaria: #60a5fa;
  --group-uncategorized: #64748b;
```

(For yellow in the light theme, dark amber `#d97706` was chosen for contrast as a fill on a light background.)

- [ ] **Step 5: Verify**

Run: `pnpm exec vitest run lib/categories/groups.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/categories/groups.ts lib/categories/groups.test.ts app/globals.css
git commit -m "feat(categorie): modulo gruppi di spesa e token colore"
```

---

### Task 2: Enum change — schema, defaults, validation, categorization, migration script

**Files:**
- Modify: `lib/db/schema/categories.ts`
- Modify: `lib/db/schema/categories.test.ts`
- Modify: `lib/validation/categories.ts`
- Modify: `lib/categorization/fallback.ts:23`
- Modify: `lib/categorization/match-rule.ts:6,18`
- Modify: `lib/categorization/suggest.ts:19`
- Modify: `app/api/transactions/route.ts:55` (JSDoc only)
- Create: `lib/db/migrate-category-groups.ts`
- Modify: `package.json` (script)
- Modify: every `*.test.ts` under `app/` and `lib/` that contains `"fissa"` or `"variabile"` (mechanical rename)

**Interfaces:**
- Consumes: `CATEGORY_TYPES`, `CategoryType` (Task 1).
- Produces: `Category["type"]` is now `CategoryType`; `DEFAULT_CATEGORIES` with the new list; `LEGACY_CATEGORY_NAMES: Record<string, string>` (old name → new name) exported from `lib/db/schema/categories.ts`, used by Task 7.

- [ ] **Step 1: Update the default categories test**

Fully replace `lib/db/schema/categories.test.ts`:

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

- [ ] **Step 2: Verify that it fails**

Run: `pnpm exec vitest run lib/db/schema/categories.test.ts`
Expected: FAIL (length 18 ≠ 25, `LEGACY_CATEGORY_NAMES` undefined).

- [ ] **Step 3: Update `lib/db/schema/categories.ts`**

Replace the enum line and everything from `export const DEFAULT_CATEGORIES` to the end:

```ts
import { boolean, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { authUser } from "./auth";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
import { CATEGORY_TYPES, type CategoryType } from "@/lib/categories/groups";

export const categoryTypeEnum = pgEnum("category_type", CATEGORY_TYPES);
```

(`categories` table and `Category`/`NewCategory` types unchanged)

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

  // --- FALLBACK (no real group: the type is just a non-null value) ---
  { name: "Da categorizzare", type: "voluta", icon: "help-circle", color: "red", isFallback: true },

  // --- ENTRATE ---
  { name: "Stipendio", type: "entrata", icon: "banknote", color: "emerald" },
  { name: "Freelance", type: "entrata", icon: "briefcase", color: "blue" },
  { name: "Dividendi e interessi", type: "entrata", icon: "trending-up", color: "teal" },
];

/**
 * Default category names from previous versions → current name. Used by the category reset
 * to update (keeping their id, and therefore transactions/rules/budgets) the categories that were only renamed.
 */
export const LEGACY_CATEGORY_NAMES: Record<string, string> = {
  "Assicurazioni & Tasse": "Assicurazioni",
  "Risparmi & Investimenti": "Investimenti",
  "Trasporti & Auto": "Trasporti",
  "Salute & Cura": "Salute & Farmaci",
  "Svago & Hobbies": "Svago & Hobby",
};
```

If `tsc` reports that a color (`lime`, `amber`, `emerald`, `rose`, `indigo`, `cyan`, `purple`, `teal`, `orange`, `pink`, `red`) is not in `CategoryColor`, replace it with one present in `SWATCH_BASE_COLORS` of `lib/validation/shared-colors.ts` (check by reading the file first).

- [ ] **Step 4: Validation, fallback, categorization**

`lib/validation/categories.ts`: add `import { CATEGORY_TYPES } from "@/lib/categories/groups";` and replace the two occurrences of `z.enum(["fissa", "variabile", "entrata"])` with `z.enum(CATEGORY_TYPES)`.

`lib/categorization/fallback.ts`: `type: "variabile",` → `type: "voluta",` (with an end-of-line comment: `// arbitrary value: the fallback is never classified by type`).

`lib/categorization/match-rule.ts`: add `import type { CategoryType } from "@/lib/categories/groups";` and replace the two `"fissa" | "variabile" | "entrata"` with `CategoryType`.

`lib/categorization/suggest.ts`: same replacement at line 19 (add the type import).

`app/api/transactions/route.ts:55`: in the JSDoc, `fissa/variabile → negato` → `gruppi di spesa → negato` ("fixed/variable → negated" → "spending groups → negated").

- [ ] **Step 5: Mechanical rename in the test fixtures**

```bash
grep -rl --include=*.test.ts -e '"fissa"' -e '"variabile"' app lib | xargs sed -i 's/"fissa"/"dovuta"/g; s/"variabile"/"voluta"/g'
grep -rn --include=*.test.ts -e '"fissa"' -e '"variabile"' app lib
```
Expected on the second line: no output. (The semantics are unchanged: `dovuta`/`voluta` are the 1:1 renames of the old values.)

- [ ] **Step 6: Enum migration script**

Create `lib/db/migrate-category-groups.ts`:

```ts
/**
 * One-shot, idempotent migration of the Postgres enum `category_type` from fissa/variabile/entrata to
 * dovuta/voluta/futuro/saltuaria/entrata (see docs/superpowers/specs/2026-09-22-categorie-gruppi-spesa-design.md).
 * Reads the current values from pg_enum and runs only the missing steps; `ADD VALUE` runs outside transactions.
 * Run with: `pnpm db:migrate-category-groups`.
 */
import { client } from "./client";

/** SQL steps needed starting from the current enum values (empty if the migration has already been applied). */
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

Create `lib/db/migrate-category-groups.test.ts`:

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

Check that `lib/db/client.ts` exports `client` (`lib/db/migrate.ts` already uses it). Then in `package.json`, after `"db:clear"`:

```json
    "db:migrate-category-groups": "tsx --env-file=.env.local lib/db/migrate-category-groups.ts",
```

- [ ] **Step 7: Unit verification**

Run: `pnpm exec vitest run lib/db/schema/categories.test.ts lib/db/migrate-category-groups.test.ts lib/categories lib/categorization lib/validation`
Expected: PASS.

Run: `pnpm exec tsc --noEmit`
Expected: errors **only** in the files owned by Tasks 3–6: `lib/calc/expenses.ts`, `lib/calc/expenses.test.ts`, `lib/calc/cashflow.ts`, `lib/calc/cashflow.test.ts`, `components/domain/expenses/category-breakdown-donut*.ts(x)`, `components/domain/cashflow/where-it-goes-breakdown.tsx`, `components/domain/categories/category-row.tsx`, `components/domain/categories/add-category-form.tsx`, `app/(app)/transazioni/page.tsx`. Any error in another file must be fixed in this task.

- [ ] **Step 8: Commit**

```bash
git add lib/db/schema/categories.ts lib/db/schema/categories.test.ts lib/validation/categories.ts lib/categorization lib/db/migrate-category-groups.ts lib/db/migrate-category-groups.test.ts package.json app/api/transactions/route.ts
git add $(git diff --name-only -- '*.test.ts')
git commit -m "feat(categorie): enum category_type a gruppi di spesa, nuovi default, script migrazione enum"
```

- [ ] **Step 9: DB migration — STOP, the user runs it**

Ask the user to run, from this worktree's directory:

```bash
pnpm db:migrate-category-groups
```

Expected output: `Valori finali: [ 'dovuta', 'voluta', 'futuro', 'saltuaria', 'entrata' ]`. Warn that from this moment the unmerged `main` code is incompatible with the shared DB until the merge. Do not proceed to the API tests until the user confirms.

After confirmation, run: `pnpm exec vitest run app/api lib/db lib/gocardless lib/net-worth`
Expected: PASS (except the 3 known ones in `scheduler.test.ts`).

---

### Task 3: Transazioni engine — `computeGroupTotals` and donut sorting

**Files:**
- Modify: `lib/calc/expenses.ts` (`CategoryAmount`, `computeCategoryBreakdown`, `FixedVsVariable`/`computeFixedVsVariable` → `GroupTotals`/`computeGroupTotals`)
- Modify: `lib/calc/expenses.test.ts:259-291` and `:547-560`
- Modify: `components/domain/expenses/category-breakdown-donut.utils.ts:1-11`
- Modify: `components/domain/expenses/category-breakdown-donut.utils.test.ts`

**Interfaces:**
- Consumes: `CategoryGroupKey`, `EXPENSE_GROUP_KEYS`, `UNCATEGORIZED_GROUP_KEY`, `categoryGroupKey` (Task 1).
- Produces:
  - `CategoryAmount = { categoryId: string; name: string; group: CategoryGroupKey; amount: number; color: string; icon: string }`
  - `type GroupTotals = Record<CategoryGroupKey, number>`
  - `computeGroupTotals(transactions, categories, period, referenceDate, today): GroupTotals` (same signature as the old `computeFixedVsVariable`)
  - `sortCategoryAmounts` sorts by `EXPENSE_GROUP_KEYS` then `daCategorizzare`, then by descending amount.

- [ ] **Step 1: Update the tests in `expenses.test.ts`**

In the import, `computeFixedVsVariable` → `computeGroupTotals`. Replace the `describe("computeCategoryBreakdown", ...)` and `describe("computeFixedVsVariable", ...)` blocks (lines 259-291) with:

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

In the `describe("computeCategoryBreakdown esclude le categorie di entrata", ...)` block (around line 547) replace any assertions on `type` with `group` (the Task 2 `sed` already turned `"variabile"` into `"voluta"` in the fixtures).

- [ ] **Step 2: Verify that they fail**

Run: `pnpm exec vitest run lib/calc/expenses.test.ts`
Expected: FAIL (`computeGroupTotals is not a function`, `group` undefined).

- [ ] **Step 3: Implement in `lib/calc/expenses.ts`**

Add at the top: `import { EXPENSE_GROUP_KEYS, UNCATEGORIZED_GROUP_KEY, categoryGroupKey, type CategoryGroupKey } from "@/lib/categories/groups";`

Replace `CategoryAmount`, `computeCategoryBreakdown`, `FixedVsVariable`, `computeFixedVsVariable` with:

```ts
export interface CategoryAmount {
  categoryId: string;
  name: string;
  /** Spending group of the category; the fallback (and unrecognized types) → "daCategorizzare". */
  group: CategoryGroupKey;
  amount: number;
  color: string;
  icon: string;
}

/** Actual spending per category in the selected period, one row for each of the user's spending categories (income excluded). */
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

/** Sums the period's actual spending per spending group (Dovute/Volute/Te futuro/Saltuarie) plus "daCategorizzare". */
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

- [ ] **Step 4: Update `category-breakdown-donut.utils.ts` and its test**

Lines 1-11 of `category-breakdown-donut.utils.ts`:

```ts
import type { CategoryAmount } from "@/lib/calc/expenses";
import { EXPENSE_GROUP_KEYS, UNCATEGORIZED_GROUP_KEY, type CategoryGroupKey } from "@/lib/categories/groups";

const GROUP_ORDER = Object.fromEntries(
  [...EXPENSE_GROUP_KEYS, UNCATEGORIZED_GROUP_KEY].map((key, index) => [key, index])
) as Record<CategoryGroupKey, number>;

/** Sorts the categories by group (Dovute → Volute → Te futuro → Saltuarie → Da categorizzare) and, within each group, by descending amount. */
export function sortCategoryAmounts(categoryAmounts: CategoryAmount[]): CategoryAmount[] {
  return [...categoryAmounts].sort((a, b) => {
    if (a.group !== b.group) return GROUP_ORDER[a.group] - GROUP_ORDER[b.group];
    return b.amount - a.amount;
  });
}
```

In `category-breakdown-donut.utils.test.ts`: in `makeEntry` replace `type: "voluta",` (already renamed by the sed) with `group: "voluta",`; throughout the file replace the override keys `type: "dovuta"` / `type: "voluta"` with `group: ...`:

```bash
sed -i 's/type: "dovuta"/group: "dovuta"/g; s/type: "voluta"/group: "voluta"/g' components/domain/expenses/category-breakdown-donut.utils.test.ts
```

Then replace the first two `it` of `describe("sortCategoryAmounts", ...)` with:

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

- [ ] **Step 5: Verify**

Run: `pnpm exec vitest run lib/calc/expenses.test.ts components/domain/expenses/category-breakdown-donut.utils.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/calc/expenses.ts lib/calc/expenses.test.ts components/domain/expenses/category-breakdown-donut.utils.ts components/domain/expenses/category-breakdown-donut.utils.test.ts
git commit -m "feat(transazioni): totali per gruppo di spesa e ordinamento torta per gruppo"
```

---

### Task 4: Cash flow — "Dove va ogni euro" by group

**Files:**
- Modify: `lib/calc/cashflow.ts:240-291`
- Modify: `lib/calc/cashflow.test.ts` (`describe("computeWhereItGoes", ...)` block)
- Modify: `components/domain/cashflow/where-it-goes-breakdown.tsx`

**Interfaces:**
- Consumes: `EXPENSE_GROUP_KEYS`, `EXPENSE_GROUPS`, `GROUP_DISPLAY`, `categoryGroupKey`, `isExpenseGroup`, `ExpenseGroup` (Task 1).
- Produces: `WhereItGoesEntry = { key: ExpenseGroup | "nonClassificato" | "avanzo"; label: string; amount: number; quotaPct: number | null }`; `computeWhereItGoes` with unchanged signature, 6 entries in the order Dovute, Volute, Te futuro, Saltuarie, Non classificato, Avanzo.

- [ ] **Step 1: Rewrite the tests**

Replace the whole `describe("computeWhereItGoes", ...)` of `lib/calc/cashflow.test.ts` with (keep the last `it` on post-"Dividi" ("Split"), adapting only its keys `"fisse"`→`"dovuta"`, `"risparmio"`→`"avanzo"`; the Task 2 sed already made it `type: "dovuta"`):

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

(followed by the existing post-"Dividi" `it`, adapted, then `});`)

- [ ] **Step 2: Verify that they fail**

Run: `pnpm exec vitest run lib/calc/cashflow.test.ts`
Expected: FAIL on the new keys.

- [ ] **Step 3: Implement in `lib/calc/cashflow.ts`**

Add the import: `import { EXPENSE_GROUP_KEYS, EXPENSE_GROUPS, categoryGroupKey, isExpenseGroup, type ExpenseGroup } from "@/lib/categories/groups";`

Replace `WhereItGoesEntry` and `computeWhereItGoes` (lines 240-291):

```ts
/** Row of `computeWhereItGoes`: a spending group, unclassified spending or the month's surplus. */
export interface WhereItGoesEntry {
  key: ExpenseGroup | "nonClassificato" | "avanzo";
  label: string;
  amount: number;
  /** null if the month's income is zero (not computable). The surplus can be negative (no floor at zero). */
  quotaPct: number | null;
}

/**
 * "Dove va ogni euro" for the reference month: spending for each group (Dovute, Volute, Te futuro,
 * Saltuarie — Te futuro counts as spending), unclassifiable spending (fallback category, missing
 * from the array or wrongly "entrata") and surplus (income − all outflows), with a % share of total
 * income. Income and outflows count the actual post-"Dividi" amount (`effectiveAmount`).
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

- [ ] **Step 4: Update `where-it-goes-breakdown.tsx`**

Replace the file:

```tsx
/** "Dove va ogni euro" block (current month): one row for each entry of `computeWhereItGoes` (spending groups, unclassified, surplus) with the group's color dot, amount and % share of the month's income — no assumption on the number of entries. */

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

- [ ] **Step 5: Verify**

Run: `pnpm exec vitest run lib/calc/cashflow.test.ts`
Expected: PASS.
Run: `pnpm exec tsc --noEmit` — no errors in `lib/calc/cashflow*.ts` nor in `where-it-goes-breakdown.tsx`.

- [ ] **Step 6: Commit**

```bash
git add lib/calc/cashflow.ts lib/calc/cashflow.test.ts components/domain/cashflow/where-it-goes-breakdown.tsx
git commit -m "feat(cash-flow): 'Dove va ogni euro' per gruppo di spesa, Risparmio rinominato Avanzo"
```

---

### Task 5: "Per categoria" ("By category") donut in Transazioni

**Files:**
- Modify: `components/domain/expenses/category-breakdown-donut.tsx`
- Modify: `app/(app)/transazioni/page.tsx:35,251`

**Interfaces:**
- Consumes: `GroupTotals`, `computeGroupTotals`, `CategoryAmount.group` (Task 3); `EXPENSE_GROUP_KEYS`, `GROUP_DISPLAY`, `UNCATEGORIZED_GROUP_KEY` (Task 1).
- Produces: `CategoryBreakdownDonutProps` with `groupTotals: GroupTotals` instead of `fixedVsVariable`.

- [ ] **Step 1: Update the component**

In `category-breakdown-donut.tsx`:

1. Header JSDoc: `(layer interno tipo fissa/variabile, layer esterno categoria)` → `(layer interno gruppo di spesa — Dovute/Volute/Te futuro/Saltuarie più "Da categorizzare" se presente —, layer esterno categoria)` (i.e. the inner layer becomes the spending group, plus "Da categorizzare" when present; the outer layer stays the category); remove the sentence `Unifica il vecchio donut "Fisse vs variabili" e la lista budget separata in un'unica card.` replacing it with `Unifica torta per gruppo e lista budget in un'unica card.` ("Merges the group donut and the budget list into a single card.")
2. Import: `import type { CategoryAmount, FixedVsVariable } from "@/lib/calc/expenses";` → `import type { CategoryAmount, GroupTotals } from "@/lib/calc/expenses";` and add
   `import { EXPENSE_GROUP_KEYS, GROUP_DISPLAY, UNCATEGORIZED_GROUP_KEY, type CategoryGroupKey } from "@/lib/categories/groups";`
3. Replace `TYPE_CONFIG` with:

```ts
const GROUP_CHART_CONFIG = Object.fromEntries(
  [...EXPENSE_GROUP_KEYS, UNCATEGORIZED_GROUP_KEY].map((key) => [
    key,
    { label: GROUP_DISPLAY[key].label, color: GROUP_DISPLAY[key].colorVar },
  ])
) satisfies ChartConfig;
```

4. Props: `fixedVsVariable: FixedVsVariable;` → `groupTotals: GroupTotals;` and in the destructuring `fixedVsVariable,` → `groupTotals,`.
5. Replace `innerData` with:

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
7. In `CategoryLegendRow`, inside `<div className="flex items-center gap-3">`, before `<CategoryAvatar`, add the group dot:

```tsx
        <span
          aria-hidden="true"
          title={GROUP_DISPLAY[entry.group].label}
          className={cn("size-2 shrink-0 rounded-full", GROUP_DISPLAY[entry.group].dotClassName)}
        />
```

and under the name, in the line `{formatCurrency(entry.amount, currency)} speso`, make the group readable to screen readers too:
`{formatCurrency(entry.amount, currency)} speso · {GROUP_DISPLAY[entry.group].label}`.

- [ ] **Step 2: Update the Transazioni page**

In `app/(app)/transazioni/page.tsx`: in the import from `@/lib/calc/expenses`, `computeFixedVsVariable,` → `computeGroupTotals,`; at line ~251:

```tsx
            groupTotals={computeGroupTotals(expenseTransactionsForAnalysis, safeCategories, period, referenceDate, today)}
```

- [ ] **Step 3: Verify**

Run: `pnpm exec tsc --noEmit`
Expected: remaining errors only in `components/domain/categories/category-row.tsx` and `add-category-form.tsx` (Task 6).
Run: `pnpm exec vitest run components/domain/expenses lib/calc`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/domain/expenses/category-breakdown-donut.tsx "app/(app)/transazioni/page.tsx"
git commit -m "feat(transazioni): anello interno della torta per gruppo di spesa, pallino gruppo in legenda"
```

---

### Task 6: `/categorie` page split by group

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

- [ ] **Step 1: Create `category-type-select.tsx`**

```tsx
"use client";

/** Category type select (four spending groups + Entrata), shared by the category row and the creation form. */

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

- [ ] **Step 2: Create `category-section.tsx`**

```tsx
/** Section of the Categorie page: header (group color dot, title, short description) and category rows. */

import * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface CategorySectionProps {
  title: string;
  description?: string;
  /** Tailwind class of the color dot; omitted for sections without a group (e.g. Entrate). */
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

- [ ] **Step 3: Use `CategoryTypeSelect` in `category-row.tsx` and `add-category-form.tsx`**

`category-row.tsx`:
- remove the `TYPE_LABELS` constant and the `Select*` import (no longer used);
- add `import { CategoryTypeSelect } from "./category-type-select";` and `import type { CategoryType } from "@/lib/categories/groups";`
- `commitType` becomes:

```ts
  function commitType(type: CategoryType) {
    if (type === category.type) return;
    updateMutation.mutate({ id: category.id, input: { type } });
  }
```

- replace the whole `<Select value={category.type} ...>...</Select>` block with:

```tsx
          <CategoryTypeSelect value={category.type} onChange={commitType} size="sm" className="h-6 w-fit text-xs" />
```

`add-category-form.tsx`:
- remove `TYPE_LABELS` and the `Select*` import;
- import: `import { CategoryTypeSelect } from "./category-type-select";` e `import { DEFAULT_NEW_CATEGORY_TYPE, type CategoryType } from "@/lib/categories/groups";`
- `useState<"fissa" | "variabile" | "entrata">("variabile")` → `useState<CategoryType>(DEFAULT_NEW_CATEGORY_TYPE)`; `setType("variabile")` → `setType(DEFAULT_NEW_CATEGORY_TYPE)`;
- replace the `<Select ...>...</Select>` block with `<CategoryTypeSelect value={type} onChange={setType} className="w-36" />`.

- [ ] **Step 4: Barrel**

In `components/domain/categories/index.ts` add:

```ts
export { CategoryTypeSelect } from "./category-type-select";
export type { CategoryTypeSelectProps } from "./category-type-select";
export { CategorySection } from "./category-section";
export type { CategorySectionProps } from "./category-section";
```

- [ ] **Step 5: `/categorie` page**

In `app/(app)/categorie/page.tsx`: import `CategorySection` from the barrel and `import { EXPENSE_GROUPS, GROUP_DISPLAY, groupCategoriesByType } from "@/lib/categories/groups";`. Subtitle: `Categorie di spesa e di entrata: nome, tipo, icona e colore.` → `Le spese sono divise in quattro gruppi: Dovute, Volute, Te futuro e Saltuarie.` Replace the `: ( <Card className="p-0"> ... </Card> )` branch with:

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

Remove the `Card` import if no longer used. (If ESLint flags the IIFE, extract the block into a local component `CategorySections({ categories })` in the same file — the page stays pure orchestration.)

- [ ] **Step 6: Verify**

Run: `pnpm exec tsc --noEmit`
Expected: **no errors**.
Run: `pnpm lint`
Expected: only the 2 known errors.
Run: `pnpm exec vitest run`
Expected: PASS except the 3 known ones in `scheduler.test.ts`.

- [ ] **Step 7: Commit**

```bash
git add components/domain/categories "app/(app)/categorie/page.tsx"
git commit -m "feat(categorie): pagina divisa per gruppi di spesa, select tipo condiviso"
```

---

### Task 7: Category reset script

**Files:**
- Create: `lib/db/reset-categories.ts`
- Create: `lib/db/reset-categories.test.ts`
- Modify: `package.json` (script)
- Modify: `lib/db/backfill-category-appearance.ts` (JSDoc only)

**Interfaces:**
- Consumes: `DEFAULT_CATEGORIES`, `LEGACY_CATEGORY_NAMES` (Task 2); `getFallbackCategoryId` (`lib/categorization/fallback.ts`); tables `categories`, `transactions`, `budgets`, `categorizationRules`.
- Produces: `planCategoryReset(existing, defaults, legacyNames): CategoryResetPlan`; `resetUserCategories(userId, { dryRun }): Promise<CategoryResetSummary>`.

- [ ] **Step 1: Write the planner tests**

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

- [ ] **Step 2: Verify that they fail**

Run: `pnpm exec vitest run lib/db/reset-categories.test.ts`
Expected: FAIL (module does not exist).

- [ ] **Step 3: Implement `lib/db/reset-categories.ts`**

```ts
/**
 * One-shot reset of every user's categories to the spending-group DEFAULT_CATEGORIES list
 * (spec 2026-09-22-categorie-gruppi-spesa). Default categories (including those with a legacy name) are
 * updated keeping their id; the others (custom ones included) are deleted, with their transactions moved
 * to the fallback and budgets/rules removed. Idempotent. Requires the already migrated enum
 * (`pnpm db:migrate-category-groups`). Run with: `pnpm db:reset-categories [--dry-run]`.
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
  /** Ids of non-fallback categories to delete. */
  deletions: string[];
}

/** Decides, without touching the DB, how to bring a user's categories to the default list. */
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
 * Applies the reset plan for a user in a single transaction. Order: reassign the transactions of the
 * categories to delete to the fallback, delete budgets and rules, delete the categories (freeing the names),
 * then update and create. With `dryRun` it only computes the summary.
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

/** Command-line run over all users that have at least one category. */
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

Note: if an update renames a legacy category to a name currently taken by a category to be deleted, the "deletions first, then updates" order avoids violating the unique constraint `(user_id, name)` — the planner guarantees that the exact name, if it exists, is always the one chosen (so the case "name taken by a category that is not deleted" cannot happen).

- [ ] **Step 4: Script and JSDoc**

`package.json`, after `db:migrate-category-groups`:

```json
    "db:reset-categories": "tsx --env-file=.env.local lib/db/reset-categories.ts",
```

`lib/db/backfill-category-appearance.ts`: add at the end of the header JSDoc the line
` * Obsolete after the category reset to spending groups (lib/db/reset-categories.ts, 2026-09-22): kept only for history.`

- [ ] **Step 5: Verify**

Run: `pnpm exec vitest run lib/db/reset-categories.test.ts`
Expected: PASS (6 tests).
Run: `pnpm exec tsc --noEmit` → no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/db/reset-categories.ts lib/db/reset-categories.test.ts package.json lib/db/backfill-category-appearance.ts
git commit -m "feat(categorie): script di reset categorie ai nuovi default a gruppi"
```

- [ ] **Step 7: Run — STOP, the user runs it**

Ask the user to run from the worktree, first `pnpm db:reset-categories --dry-run` (check the per-user summary), then `pnpm db:reset-categories`. A second run must print `0 aggiornate, 0 create, 0 eliminate` for every user.

---

### Task 8: Documentation and final verification

**Files:**
- Modify: `docs/functional-spec.md` (Spese/Transazioni and Cash flow sections)
- Modify: `CLAUDE.md` ("Stato del progetto" + log entry)

**Interfaces:**
- Consumes: everything above. Produces: nothing.

- [ ] **Step 1: `docs/functional-spec.md`**

Look for the occurrences of "fisse", "variabili", "Fisse vs variabili", "Risparmio" in the Spese and Cash flow sections (`grep -n -i "fiss\|variabil\|risparmio" docs/functional-spec.md`) and update them: spending categories belong to one of four groups (Dovute, Volute, Te futuro, Saltuarie — with the short definition of each); the Transazioni donut has the inner ring by group (plus "Da categorizzare"); "Dove va ogni euro" in Cash flow has the entries Dovute, Volute, Te futuro, Saltuarie, Non classificato, Avanzo, and "Te futuro" counts as spending.

- [ ] **Step 2: `CLAUDE.md`**

In "Stato del progetto" add the completion of the plan `docs/superpowers/plans/2026-09-22-categorie-gruppi-spesa.md` with the manual user verification to do (from the spec, section "Verifica manuale utente"). In the "Log delle decisioni" add at the top a **2026-09-22** entry with: the brainstorming decisions (Te futuro = spending, Saltuarie grouping only, category reset, short labels, enum replaced), the `db:migrate-category-groups` + `db:reset-categories` scripts, the "Risparmio"→"Avanzo" ("Savings"→"Surplus") rename in Cash flow, fallback outside the groups, out of scope (budget per group, filter by group, setting money aside for Saltuarie).

- [ ] **Step 3: Final verification**

```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm exec vitest run
grep -rn --include=*.ts --include=*.tsx -e '"fissa"' -e '"variabile"' -e "'fissa'" -e "'variabile'" app components lib
```

Expected: `tsc` clean; lint with only the 2 known errors; vitest green except the 3 known ones in `scheduler.test.ts`; the `grep` returns only the lines of `lib/db/migrate-category-groups.ts` and its test (the legacy values the script migrates).

- [ ] **Step 4: Commit**

```bash
git add docs/functional-spec.md CLAUDE.md
git commit -m "docs: gruppi di spesa categorie in functional-spec e CLAUDE.md"
```
