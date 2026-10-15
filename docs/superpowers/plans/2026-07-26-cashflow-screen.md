# Cash flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Cash flow screen (income vs. expense comparison, 12-month trend, income sources, "where every euro goes", accumulated savings) and the minimal generalization of the Spese screen needed to record income transactions in the first place.

**Architecture:** Extend `categoryTypeEnum` with a third value `"entrata"`; income/expense direction is derived from `amount` sign (already the case) and validated server-side against the chosen category's `type`. A new pure calc module `lib/calc/cashflow.ts` computes all Cash flow KPIs/series from the same `transactions`/`categories` data already used by Spese, fetched client-side via TanStack Query and computed in the browser — no new API routes. The Spese screen is relabeled "Transazioni" and gains a minimal type toggle (Tutte/Uscite/Entrate) on the list only; its existing KPI/donut/trend widgets stay expense-only, unaffected by the toggle.

**Tech Stack:** Next.js App Router, TypeScript, Drizzle ORM + Postgres, TanStack Query, Zod, Recharts via shadcn `Chart`, vitest.

## Global Constraints

- All visible strings in Italian (i18n not yet implemented).
- No hardcoded color/radius: use the existing Tailwind tokens/CSS vars (`--pos`, `--neg`, `--chart-1`, `--chart-2`, `SWATCH_CHART_COLOR`).
- Minimal JSDoc (one `/** ... */` line) on every new public component/function.
- Barrel file (`index.ts`) for every new or touched component folder; external imports always from the barrel.
- Prop types of public components always exported.
- Layer architecture: `components/domain/**` does not depend on `app/**`; `app/**` orchestrates.
- Package manager: `pnpm`. Tests: `pnpm test` (= `vitest run`). No dedicated `typecheck` script: use `pnpm exec tsc --noEmit` for the type check of the tasks that touch only React components/pages (no automated test convention for `.tsx` in this repo — only `lib/calc/*.test.ts` and `app/api/**/route.test.ts` exist).
- **`pnpm db:push` is always run by the user, never by an agent** (established convention of this project — see CLAUDE.md). Task 1 includes an explicit checkpoint that requires this manual step before continuing.
- The API tests (`route.test.ts`) run against a real Postgres via `db`/`client` of `lib/db/client` — no DB mock, only a mock of `auth.api.getSession`.

---

## File Structure

**Create:**
- `components/domain/expenses/transactions-type-toggle.tsx` — Tutte/Uscite/Entrate (All/Outflows/Income) toggle for the transaction list.
- `lib/calc/cashflow.ts` — pure Cash flow calculation engine.
- `lib/calc/cashflow.test.ts` — engine tests.
- `components/domain/cashflow/cashflow-period-selector.tsx` — 3M/6M/12M/24M pills.
- `components/domain/cashflow/cashflow-reference-nav.tsx` — prev/next arrows on the period.
- `components/domain/cashflow/cashflow-kpi-cards.tsx` — 4 KPI.
- `components/domain/cashflow/cashflow-trend-chart.tsx` — side-by-side income/outflow bars.
- `components/domain/cashflow/income-sources-list.tsx` — "Fonti di entrata" ("Income sources") list.
- `components/domain/cashflow/where-it-goes-breakdown.tsx` — "Dove va ogni euro" ("Where every euro goes") block.
- `components/domain/cashflow/accumulated-savings-chart.tsx` — "Risparmio accumulato" ("Accumulated savings") chart.
- `components/domain/cashflow/index.ts` — barrel.
- `app/(app)/cash-flow/page.tsx` — orchestration page (read-only).

**Modify:**
- `lib/db/schema/categories.ts` — enum `+"entrata"`, 3 new income `DEFAULT_CATEGORIES`, fix for the missing `"shield"` icon (pre-existing bug, it blocks the test file that this task has to touch anyway).
- `lib/db/schema/categories.test.ts` — updated count and asserts.
- `lib/validation/categories.ts` — `createCategorySchema`/`updateCategorySchema` enum type `+"entrata"`.
- `components/domain/categories/add-category-form.tsx` — "Entrata" ("Income") option.
- `components/domain/categories/category-row.tsx` — "Entrata" option.
- `lib/calc/expenses.ts` — `isIncome`, `filterByTransactionType`, income filter in `computeCategoryBreakdown`, export of `startOfMonth`/`endOfMonth`/`addMonths` (reused by `cashflow.ts`).
- `lib/calc/expenses.test.ts` — tests for the additions above.
- `app/api/transactions/route.ts` — `GET` `type` parameter, `POST` sign derived from the category.
- `app/api/transactions/route.test.ts` — tests for the changes above.
- `app/api/transactions/[id]/route.ts` — `PATCH` derived sign + direction/category compatibility guard.
- `app/api/transactions/[id]/route.test.ts` — tests for the changes above.
- `lib/queries/transactions.ts` — `useTransactionsQuery` accepts a `type` parameter.
- `components/domain/expenses/add-transaction-form.tsx` — Spesa/Entrata (Expense/Income) toggle, category filter.
- `components/domain/expenses/transaction-row.tsx` — category select filtered by direction, "Dividi" ("Split") hidden for income.
- `components/domain/expenses/index.ts` — export `TransactionsTypeToggle`.
- `app/(app)/spese/page.tsx` — renamed to "Transazioni", list type toggle, analysis widgets always outflows-only.
- `components/layout/sidebar.tsx` — nav label `"Spese"` → `"Transazioni"`.

---

### Task 1: Income categories — schema, validation, seed, UI

**Files:**
- Modify: `lib/db/schema/categories.ts`
- Modify: `lib/db/schema/categories.test.ts`
- Modify: `lib/validation/categories.ts`
- Modify: `components/domain/categories/add-category-form.tsx`
- Modify: `components/domain/categories/category-row.tsx`

**Interfaces:**
- Produces: `categoryTypeEnum` with values `["fissa", "variabile", "entrata"]`; `Category["type"]: "fissa" | "variabile" | "entrata"`; `createCategorySchema`/`updateCategorySchema` with the same extended enum — used by all the following tasks that read/write categories.

- [ ] **Step 1: Write the test that checks the new count and the new income categories**

Replace the contents of `lib/db/schema/categories.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { CATEGORY_COLORS, CATEGORY_ICONS } from "@/lib/validation/categories";
import { DEFAULT_CATEGORIES } from "./categories";

describe("DEFAULT_CATEGORIES", () => {
  it("ha 18 categorie", () => {
    expect(DEFAULT_CATEGORIES).toHaveLength(18);
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

  it("ha 3 categorie di tipo entrata: Stipendio, Freelance, Dividendi e interessi", () => {
    const incomeEntries = DEFAULT_CATEGORIES.filter((c) => c.type === "entrata");
    expect(incomeEntries.map((c) => c.name).sort()).toEqual(
      ["Dividendi e interessi", "Freelance", "Stipendio"].sort()
    );
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm test lib/db/schema/categories.test.ts`
Expected: FAIL — the current count is 15 (not 18), no category with `type === "entrata"` exists yet, and even before that the "valid icon/color" test already fails today (pre-existing bug: `"shield"` in `Assicurazioni & Tasse` is not in `CATEGORY_ICONS`).

- [ ] **Step 3: Extend the enum and the validation types**

In `lib/validation/categories.ts`, replace lines 22-40:

```typescript
export const createCategorySchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(["fissa", "variabile", "entrata"]),
  color: z.enum(CATEGORY_COLORS).optional(),
  icon: z.enum(CATEGORY_ICONS).optional(),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    type: z.enum(["fissa", "variabile", "entrata"]).optional(),
    color: z.enum(CATEGORY_COLORS).optional(),
    icon: z.enum(CATEGORY_ICONS).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Nessun campo da aggiornare",
  });
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
```

Also add `"shield"` to `CATEGORY_ICONS` (lines 7-19), between `"paw-print"` and `"shirt"` (fix for the pre-existing bug that blocks the test at Step 2):

```typescript
export const CATEGORY_ICONS = [
  "utensils", "shopping-cart", "home", "zap", "droplet", "wifi", "tv",
  "smartphone", "car", "bus", "plane", "fuel", "film", "gamepad-2",
  "music", "heart", "stethoscope", "dumbbell", "graduation-cap", "baby",
  "paw-print", "shield", "shirt", "scissors", "gift", "briefcase", "wrench",
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

In `lib/db/schema/categories.ts`, change line 5:

```typescript
export const categoryTypeEnum = pgEnum("category_type", ["fissa", "variabile", "entrata"]);
```

And update the signature of the `DEFAULT_CATEGORIES` array (lines 27-32) and add the 3 new entries at the bottom of the array (after `"Da categorizzare"`, line 55):

```typescript
export const DEFAULT_CATEGORIES: {
  name: string;
  type: "fissa" | "variabile" | "entrata";
  icon: string; // E.g. Lucide Icons
  color: string;
  isFallback?: boolean;
}[] = [
  // --- FIXED EXPENSES (your monthly/yearly commitments) ---
  { name: "Affitto & Mutuo", type: "fissa", icon: "home", color: "slate" },
  { name: "Bollette & Utenze", type: "fissa", icon: "zap", color: "yellow" },
  { name: "Abbonamenti", type: "fissa", icon: "tv", color: "purple" },
  { name: "Assicurazioni & Tasse", type: "fissa", icon: "shield", color: "indigo" },
  { name: "Risparmi & Investimenti", type: "fissa", icon: "piggy-bank", color: "emerald" },

  // --- VARIABLE NECESSITIES (you have to do them, but the amount changes) ---
  { name: "Spesa alimentare", type: "variabile", icon: "shopping-cart", color: "green" },
  { name: "Trasporti & Auto", type: "variabile", icon: "car", color: "blue" },
  { name: "Salute & Cura", type: "variabile", icon: "heart", color: "rose" },

  // --- LIFESTYLE (discretionary, where you can cut if needed) ---
  { name: "Ristoranti & Bar", type: "variabile", icon: "utensils", color: "orange" },
  { name: "Shopping", type: "variabile", icon: "shopping-bag", color: "pink" },
  { name: "Svago & Hobbies", type: "variabile", icon: "smile", color: "teal" },
  { name: "Viaggi", type: "variabile", icon: "plane", color: "cyan" },
  { name: "Regali", type: "variabile", icon: "gift", color: "fuchsia" },

  // --- EMERGENCY MANAGEMENT AND FALLBACK ---
  { name: "Imprevisti", type: "variabile", icon: "alert-triangle", color: "amber" },
  { name: "Da categorizzare", type: "variabile", icon: "help-circle", color: "slate", isFallback: true },

  // --- INCOME ---
  { name: "Stipendio", type: "entrata", icon: "banknote", color: "emerald" },
  { name: "Freelance", type: "entrata", icon: "briefcase", color: "blue" },
  { name: "Dividendi e interessi", type: "entrata", icon: "trending-up", color: "teal" },
];
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm test lib/db/schema/categories.test.ts`
Expected: PASS (4 green tests)

- [ ] **Step 5: Update the category management UI for the "Entrata" option**

In `components/domain/categories/add-category-form.tsx`, replace lines 11-14, 24, 66-73:

```typescript
const TYPE_LABELS: Record<"fissa" | "variabile" | "entrata", string> = {
  fissa: "Fissa",
  variabile: "Variabile",
  entrata: "Entrata",
};
```

```typescript
  const [type, setType] = React.useState<"fissa" | "variabile" | "entrata">("variabile");
```

```typescript
        <Select value={type} onValueChange={(value) => value && setType(value as "fissa" | "variabile" | "entrata")}>
          <SelectTrigger className="w-32">
            <SelectValue>{(value: "fissa" | "variabile" | "entrata") => TYPE_LABELS[value]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fissa">Fissa</SelectItem>
            <SelectItem value="variabile">Variabile</SelectItem>
            <SelectItem value="entrata">Entrata</SelectItem>
          </SelectContent>
        </Select>
```

In `components/domain/categories/category-row.tsx`, replace lines 31-34, 65-67, 103-113:

```typescript
const TYPE_LABELS: Record<"fissa" | "variabile" | "entrata", string> = {
  fissa: "Fissa",
  variabile: "Variabile",
  entrata: "Entrata",
};
```

```typescript
  function commitType(type: string | null) {
    if (type === null || type === category.type) return;
    updateMutation.mutate({ id: category.id, input: { type: type as "fissa" | "variabile" | "entrata" } });
  }
```

```typescript
          <Select value={category.type} onValueChange={commitType}>
            <SelectTrigger size="sm" className="h-6 w-fit text-xs">
              <SelectValue>
                {(value: "fissa" | "variabile" | "entrata") => TYPE_LABELS[value]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fissa">Fissa</SelectItem>
              <SelectItem value="variabile">Variabile</SelectItem>
              <SelectItem value="entrata">Entrata</SelectItem>
            </SelectContent>
          </Select>
```

- [ ] **Step 6: Type check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add lib/db/schema/categories.ts lib/db/schema/categories.test.ts lib/validation/categories.ts components/domain/categories/add-category-form.tsx components/domain/categories/category-row.tsx
git commit -m "feat: aggiungi categorie di tipo entrata (schema, validazione, UI)"
```

- [ ] **Step 8: MANUAL CHECKPOINT — ask the user for `pnpm db:push`**

The new enum value `"entrata"` must be applied to the real Postgres. By convention of this project, **do not run `pnpm db:push` autonomously**: stop here and explicitly ask the user to run it from the root of the current repository/worktree, then confirm it has been done before moving on to Task 2. Without this step, any API route of the following tasks that inserts a category with `type: "entrata"` will fail against the real DB (enum constraint not updated).

---

### Task 2: Spese calculation engine — transaction direction

**Files:**
- Modify: `lib/calc/expenses.ts`
- Modify: `lib/calc/expenses.test.ts`

**Interfaces:**
- Consumes: `Transaction` (`lib/db/schema/transactions.ts`).
- Produces: `isIncome(transaction): boolean`; `type TransactionDirection = "tutte" | "uscita" | "entrata"`; `filterByTransactionType(transactions, direction): Transaction[]`; `startOfMonth`/`endOfMonth`/`addMonths` now exported (used by `lib/calc/cashflow.ts` in Task 8). `computeCategoryBreakdown` now excludes categories with `type === "entrata"` from the result (its return type `CategoryAmount["type"]` stays `"fissa" | "variabile"`, unchanged).

- [ ] **Step 1: Write the failing tests**

Add to `lib/calc/expenses.test.ts` (in the import at the top of the file, add `isIncome`, `filterByTransactionType` to the list already imported from `./expenses`), then add these `describe` blocks at the bottom of the file:

```typescript
describe("isIncome", () => {
  it("è true per un importo positivo", () => {
    expect(isIncome(makeTransaction({ amount: "1500.00" }))).toBe(true);
  });

  it("è false per un importo negativo o zero", () => {
    expect(isIncome(makeTransaction({ amount: "-10.00" }))).toBe(false);
    expect(isIncome(makeTransaction({ amount: "0.00" }))).toBe(false);
  });
});

describe("filterByTransactionType", () => {
  const income = makeTransaction({ id: "t-income", amount: "1500.00" });
  const expense = makeTransaction({ id: "t-expense", amount: "-30.00" });
  const all = [income, expense];

  it("'tutte' non filtra nulla", () => {
    expect(filterByTransactionType(all, "tutte")).toEqual(all);
  });

  it("'uscita' tiene solo gli importi negativi", () => {
    expect(filterByTransactionType(all, "uscita")).toEqual([expense]);
  });

  it("'entrata' tiene solo gli importi positivi", () => {
    expect(filterByTransactionType(all, "entrata")).toEqual([income]);
  });
});

describe("computeCategoryBreakdown esclude le categorie di entrata", () => {
  it("non include una categoria type 'entrata' nel risultato", () => {
    const variabile = makeCategory({ id: "cat-var", type: "variabile" });
    const entrata = makeCategory({ id: "cat-income", name: "Stipendio", type: "entrata" });
    const transactions = [
      makeTransaction({ categoryId: "cat-var", amount: "-50.00", date: "2026-02-05" }),
      makeTransaction({ categoryId: "cat-income", amount: "1500.00", date: "2026-02-01" }),
    ];
    const referenceDate = new Date(2026, 1, 10);
    const today = referenceDate;

    const breakdown = computeCategoryBreakdown(transactions, [variabile, entrata], "mese", referenceDate, today);

    expect(breakdown.map((entry) => entry.categoryId)).toEqual(["cat-var"]);
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm test lib/calc/expenses.test.ts`
Expected: FAIL — `isIncome`/`filterByTransactionType` do not exist yet; `computeCategoryBreakdown` still includes the income category (amount 0, but present in the result).

- [ ] **Step 3: Implement**

In `lib/calc/expenses.ts`, make public the three already existing date-math functions (lines 26-46): add `export` in front of each:

```typescript
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}
```

(leave `startOfISOWeek`/`addDays` private, `cashflow.ts` does not need them)

```typescript
export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
}
```

Right after `isExpense` (after line 149), add:

```typescript
/** Real income transaction: positive amount. */
export function isIncome(transaction: Transaction): boolean {
  return Number(transaction.amount) > 0;
}

/** Direction for the list-type filter of the Transazioni screen. */
export type TransactionDirection = "tutte" | "uscita" | "entrata";

/** Filters by direction (income/outflow), or does not filter at all ("tutte"). */
export function filterByTransactionType(
  transactions: Transaction[],
  direction: TransactionDirection
): Transaction[] {
  switch (direction) {
    case "tutte":
      return transactions;
    case "uscita":
      return transactions.filter(isExpense);
    case "entrata":
      return transactions.filter(isIncome);
  }
}
```

In `computeCategoryBreakdown` (lines 246-273), add the filter right after the signature, before the `return`:

```typescript
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

  return categories
    .filter((category) => category.type !== "entrata")
    .map((category) => {
      const categoryTransactions = transactions.filter((t) => t.categoryId === category.id);
      const { speseEffettive } = computeSummary(categoryTransactions, elapsedRange);
      return {
        categoryId: category.id,
        name: category.name,
        type: category.type,
        amount: speseEffettive,
        color: category.color,
        icon: category.icon,
      };
    });
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pnpm test lib/calc/expenses.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/calc/expenses.ts lib/calc/expenses.test.ts
git commit -m "feat: aggiungi isIncome/filterByTransactionType, escludi entrate dal breakdown categorie"
```

---

### Task 3: Transactions API — type filter + sign derived from the category

**Files:**
- Modify: `app/api/transactions/route.ts`
- Modify: `app/api/transactions/route.test.ts`
- Modify: `app/api/transactions/[id]/route.ts`
- Modify: `app/api/transactions/[id]/route.test.ts`

**Interfaces:**
- Consumes: `categories.type` (Task 1).
- Produces: `GET /api/transactions?type=uscita|entrata|tutte` (default `uscita`, backward compatible); `POST`/`PATCH` derive the stored sign from the `type` of the involved category instead of always negating the amount.

- [ ] **Step 1: Write the failing tests for GET/POST**

Add to `app/api/transactions/route.test.ts`, inside the existing `describe`, after the test `"crea una spesa manuale..."` (after line 140):

```typescript
  it("crea un'entrata con importo positivo quando la categoria è di tipo entrata", async () => {
    const [incomeCategory] = await db
      .insert(categories)
      .values({ userId, name: "Stipendio", type: "entrata" })
      .returning();

    const response = await POST(
      new NextRequest("http://localhost/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          accountId: manualAccountId,
          description: "Stipendio di febbraio",
          categoryId: incomeCategory.id,
          amount: 1800,
          date: "2026-02-27",
        }),
      })
    );
    expect(response.status).toBe(201);
    const created = await response.json();
    expect(created.amount).toBe("1800.00");
  });

  it("GET con type=entrata ritorna solo le entrate", async () => {
    const [incomeCategory] = await db
      .insert(categories)
      .values({ userId, name: "Stipendio", type: "entrata" })
      .returning();
    await db.insert(transactions).values([
      { userId, accountId: manualAccountId, categoryId, description: "Spesa", amount: "-20.00", date: "2026-02-05", source: "manuale" },
      { userId, accountId: manualAccountId, categoryId: incomeCategory.id, description: "Stipendio", amount: "1800.00", date: "2026-02-27", source: "manuale" },
    ]);

    const response = await GET(
      new NextRequest("http://localhost/api/transactions?from=2026-01-01&to=2026-12-31&type=entrata")
    );
    const list = await response.json();
    expect(list).toHaveLength(1);
    expect(list[0].description).toBe("Stipendio");
  });

  it("GET con type=tutte ritorna sia entrate che uscite", async () => {
    const [incomeCategory] = await db
      .insert(categories)
      .values({ userId, name: "Stipendio", type: "entrata" })
      .returning();
    await db.insert(transactions).values([
      { userId, accountId: manualAccountId, categoryId, description: "Spesa", amount: "-20.00", date: "2026-02-05", source: "manuale" },
      { userId, accountId: manualAccountId, categoryId: incomeCategory.id, description: "Stipendio", amount: "1800.00", date: "2026-02-27", source: "manuale" },
    ]);

    const response = await GET(
      new NextRequest("http://localhost/api/transactions?from=2026-01-01&to=2026-12-31&type=tutte")
    );
    const list = await response.json();
    expect(list).toHaveLength(2);
  });

  it("risponde 400 se type non è uno dei valori validi", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/transactions?from=2026-01-01&to=2026-12-31&type=boh")
    );
    expect(response.status).toBe(400);
  });
```

- [ ] **Step 2: Write the failing tests for PATCH**

Add to `app/api/transactions/[id]/route.test.ts` two new variables in the `describe` (after `otherUserCategoryId`, line 25) and populate them in the `beforeEach` (after `otherUserCategory`, line 78):

```typescript
  let incomeCategoryId: string;
  let fallbackCategoryId: string;
```

```typescript
    const [incomeCategory] = await db
      .insert(categories)
      .values({ userId, name: "Stipendio", type: "entrata" })
      .returning();
    incomeCategoryId = incomeCategory.id;

    const [fallbackCategory] = await db
      .insert(categories)
      .values({ userId, name: "Da categorizzare", type: "variabile", isFallback: true })
      .returning();
    fallbackCategoryId = fallbackCategory.id;
```

Then add these tests, after the test `"risponde 400 se categoryId appartiene a un altro utente"` (after line 279):

```typescript
  it("risponde 400 se si cambia categoria con una di direzione incompatibile (entrata su una spesa)", async () => {
    const [transaction] = await db
      .insert(transactions)
      .values({ userId, accountId, categoryId, description: "Spesa", amount: "-50.00", date: "2026-02-10", source: "manuale" })
      .returning();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/transactions/${transaction.id}`, {
        method: "PATCH",
        body: JSON.stringify({ categoryId: incomeCategoryId }),
      }),
      { params: Promise.resolve({ id: transaction.id }) }
    );

    expect(response.status).toBe(400);
  });

  it("permette di riassegnare a 'Da categorizzare' anche con direzione diversa (guard bypassata per la fallback)", async () => {
    const [transaction] = await db
      .insert(transactions)
      .values({ userId, accountId, categoryId, description: "Spesa", amount: "-50.00", date: "2026-02-10", source: "manuale" })
      .returning();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/transactions/${transaction.id}`, {
        method: "PATCH",
        body: JSON.stringify({ categoryId: fallbackCategoryId }),
      }),
      { params: Promise.resolve({ id: transaction.id }) }
    );

    expect(response.status).toBe(200);
    const updated = await response.json();
    expect(updated.categoryId).toBe(fallbackCategoryId);
    expect(updated.amount).toBe("-50.00");
  });

  it("deriva il segno dal tipo della nuova categoria quando categoria e importo cambiano insieme", async () => {
    const [transaction] = await db
      .insert(transactions)
      .values({ userId, accountId, categoryId, description: "Da correggere", amount: "-50.00", date: "2026-02-10", source: "manuale" })
      .returning();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/transactions/${transaction.id}`, {
        method: "PATCH",
        body: JSON.stringify({ categoryId: incomeCategoryId, amount: 50 }),
      }),
      { params: Promise.resolve({ id: transaction.id }) }
    );

    expect(response.status).toBe(200);
    const updated = await response.json();
    expect(updated.categoryId).toBe(incomeCategoryId);
    expect(updated.amount).toBe("50.00");
  });

  it("preserva la direzione entrata quando si modifica solo l'importo", async () => {
    const [transaction] = await db
      .insert(transactions)
      .values({ userId, accountId, categoryId: incomeCategoryId, description: "Stipendio", amount: "1500.00", date: "2026-02-27", source: "manuale" })
      .returning();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/transactions/${transaction.id}`, {
        method: "PATCH",
        body: JSON.stringify({ amount: 1600 }),
      }),
      { params: Promise.resolve({ id: transaction.id }) }
    );

    expect(response.status).toBe(200);
    const updated = await response.json();
    expect(updated.amount).toBe("1600.00");
  });
```

- [ ] **Step 3: Run the tests and verify they fail**

Run: `pnpm test app/api/transactions`
Expected: FAIL on all the new tests (GET ignores `type`, POST always negates the amount, PATCH applies no guard).

- [ ] **Step 4: Implement GET/POST**

Replace `app/api/transactions/route.ts` entirely:

```typescript
import { NextRequest } from "next/server";
import { and, desc, eq, gt, gte, lt, lte } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";
import { createTransactionSchema } from "@/lib/validation/transactions";

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;
const VALID_TYPES = ["uscita", "entrata", "tutte"] as const;
type TypeParam = (typeof VALID_TYPES)[number];

/** GET /api/transactions?from&to&type — returns the authenticated user's transactions in the given period, filtered by direction (default "uscita", backward compatible). */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!from || !to) {
    return Response.json({ error: "from e to sono obbligatori (YYYY-MM-DD)" }, { status: 400 });
  }
  if (!DATE_FORMAT.test(from) || !DATE_FORMAT.test(to)) {
    return Response.json({ error: "from e to devono avere formato YYYY-MM-DD" }, { status: 400 });
  }

  const typeParam = (url.searchParams.get("type") ?? "uscita") as TypeParam;
  if (!VALID_TYPES.includes(typeParam)) {
    return Response.json({ error: "type deve essere uno tra uscita, entrata, tutte" }, { status: 400 });
  }

  const directionCondition =
    typeParam === "uscita" ? lt(transactions.amount, "0") : typeParam === "entrata" ? gt(transactions.amount, "0") : undefined;

  const rows = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, session.user.id),
        gte(transactions.date, from),
        lte(transactions.date, to),
        ...(directionCondition ? [directionCondition] : [])
      )
    )
    .orderBy(desc(transactions.date));

  return Response.json(rows);
}

/** POST /api/transactions — creates a manual transaction; the stored sign is derived from the type of the chosen category (entrata → positive, fissa/variabile → negated). */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }

  const body = await request.json();
  const parsed = createTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, parsed.data.accountId), eq(accounts.userId, session.user.id)));
  if (!account) {
    return Response.json({ error: "Conto non valido" }, { status: 400 });
  }
  if (account.source === "auto") {
    return Response.json(
      { error: "Non è possibile aggiungere una spesa manuale a un conto collegato automaticamente" },
      { status: 400 }
    );
  }

  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, parsed.data.categoryId), eq(categories.userId, session.user.id)));
  if (!category) {
    return Response.json({ error: "Categoria non valida" }, { status: 400 });
  }

  const signedAmount = category.type === "entrata" ? parsed.data.amount : -parsed.data.amount;

  const [transaction] = await db
    .insert(transactions)
    .values({
      userId: session.user.id,
      accountId: parsed.data.accountId,
      categoryId: parsed.data.categoryId,
      description: parsed.data.description,
      amount: signedAmount.toFixed(2),
      date: parsed.data.date,
      source: "manuale",
    })
    .returning();

  return Response.json(transaction, { status: 201 });
}
```

- [ ] **Step 5: Implement PATCH**

In `app/api/transactions/[id]/route.ts`, replace the block at lines 53-67 (from the `categoryId` validation up to and including the computation of `newAmount`/`newExcludedAmount` — do not touch the following `isValidExcludedAmount` revalidation block, which stays unchanged right after):

```typescript
  let resolvedCategory: typeof categories.$inferSelect | null = null;
  if (parsed.data.categoryId !== undefined) {
    const [category] = await db
      .select()
      .from(categories)
      .where(and(eq(categories.id, parsed.data.categoryId), eq(categories.userId, session.user.id)));
    if (!category) {
      return Response.json({ error: "Categoria non valida" }, { status: 400 });
    }
    resolvedCategory = category;
  }

  const currentIsIncome = Number(transaction.amount) > 0;

  // If the category is changed without touching the amount, the new category must have a direction
  // compatible with the already stored sign (unless it is the fallback category, which has no
  // direction of its own and can accept transactions of both signs).
  if (resolvedCategory && parsed.data.amount === undefined && !resolvedCategory.isFallback) {
    const newCategoryIsIncome = resolvedCategory.type === "entrata";
    if (newCategoryIsIncome !== currentIsIncome) {
      return Response.json(
        { error: "La categoria scelta non è compatibile con la direzione della transazione" },
        { status: 400 }
      );
    }
  }

  // Direction to use for the sign of the new amount: that of the newly assigned category
  // (if not fallback), otherwise the one already in effect on the transaction.
  const signIsIncome =
    resolvedCategory && !resolvedCategory.isFallback ? resolvedCategory.type === "entrata" : currentIsIncome;

  const newAmount =
    parsed.data.amount !== undefined
      ? signIsIncome
        ? parsed.data.amount
        : -parsed.data.amount
      : Number(transaction.amount);
  let newExcludedAmount: number | undefined;
  if (parsed.data.excludedAmount !== undefined) {
    newExcludedAmount = -Math.abs(parsed.data.excludedAmount);
  }
```

The rest of the file (`isValidExcludedAmount` validation and the final `update`) stays unchanged.

- [ ] **Step 6: Run the tests and verify they pass**

Run: `pnpm test app/api/transactions`
Expected: PASS (all the existing tests + the new ones)

- [ ] **Step 7: Commit**

```bash
git add app/api/transactions
git commit -m "feat: API transazioni supportano entrate (filtro type, segno derivato dalla categoria)"
```

---

### Task 4: Transactions query hook — type parameter

**Files:**
- Modify: `lib/queries/transactions.ts`

**Interfaces:**
- Consumes: `GET /api/transactions?type=` (Task 3).
- Produces: `useTransactionsQuery(from, to, type: "uscita" | "entrata" | "tutte" = "uscita")` — the existing callers (Spese) keep working without changes if they do not pass the third argument.

- [ ] **Step 1: Implement**

In `lib/queries/transactions.ts`, replace lines 8-23:

```typescript
export type TransactionDirectionParam = "uscita" | "entrata" | "tutte";

function transactionsQueryKey(from: string, to: string, type: TransactionDirectionParam) {
  return ["transactions", from, to, type] as const;
}

async function fetchTransactions(from: string, to: string, type: TransactionDirectionParam): Promise<Transaction[]> {
  const response = await fetch(`/api/transactions?from=${from}&to=${to}&type=${type}`);
  if (!response.ok) {
    throw new Error("Impossibile caricare le transazioni");
  }
  return response.json();
}

/** Fetches the user's transactions in the range [from, to] (YYYY-MM-DD), filtered by direction (default "uscita"). */
export function useTransactionsQuery(from: string, to: string, type: TransactionDirectionParam = "uscita") {
  return useQuery({ queryKey: transactionsQueryKey(from, to, type), queryFn: () => fetchTransactions(from, to, type) });
}
```

- [ ] **Step 2: Type check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors (the signature with a default keeps all the existing one/two-argument calls compatible).

- [ ] **Step 3: Commit**

```bash
git add lib/queries/transactions.ts
git commit -m "feat: useTransactionsQuery accetta un parametro di direzione"
```

---

### Task 5: "Aggiungi transazione" ("Add transaction") form — Spesa/Entrata toggle

**Files:**
- Modify: `components/domain/expenses/add-transaction-form.tsx`

**Interfaces:**
- Consumes: `Category["type"]` (Task 1).
- Produces: no new public prop — `AddTransactionFormProps` unchanged (it still receives all the categories, filters internally).

- [ ] **Step 1: Implement**

In `components/domain/expenses/add-transaction-form.tsx`, add the direction state and the category filter. Replace lines 29-46:

```typescript
  const [accountIdOverride, setAccountIdOverride] = React.useState<string | null>(null);
  const [direction, setDirection] = React.useState<"spesa" | "entrata">("spesa");
  const [description, setDescription] = React.useState("");
  const [categoryIdOverride, setCategoryIdOverride] = React.useState<string | null>(null);
  const [amountValue, setAmountValue] = React.useState<number | null>(null);
  const [date, setDate] = React.useState(todayDateString());
  const [error, setError] = React.useState<string | null>(null);

  const availableCategories = categories.filter((c) => (direction === "entrata" ? c.type === "entrata" : c.type !== "entrata"));

  function handleDirectionChange(next: "spesa" | "entrata") {
    setDirection(next);
    setCategoryIdOverride(null);
  }

  // Preselect the first available account/category until the user explicitly chooses.
  const accountId = accountIdOverride ?? manualAccounts[0]?.id ?? "";
  const categoryId = categoryIdOverride ?? availableCategories[0]?.id ?? "";

  const canSubmit =
    accountId !== "" &&
    description.trim() !== "" &&
    categoryId !== "" &&
    amountValue !== null &&
    amountValue > 0 &&
    date !== "";
```

Add the toggle in the form JSX, right before the "Conto" ("Account") block (before the line with `<div className="flex w-full min-w-0 flex-col gap-1 sm:w-auto">` that contains "Conto"):

```typescript
      <div className="flex w-full min-w-0 flex-col gap-1 sm:w-auto">
        <label className="text-xs text-muted-foreground">Tipo</label>
        <div className="inline-flex w-fit items-center gap-1 rounded-lg bg-muted p-1">
          {(["spesa", "entrata"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => handleDirectionChange(option)}
              aria-pressed={direction === option}
              className={
                direction === option
                  ? "rounded-md bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-sm"
                  : "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
              }
            >
              {option === "spesa" ? "Spesa" : "Entrata"}
            </button>
          ))}
        </div>
      </div>
```

And replace the "Categoria" select block (lines 117-140) to use `availableCategories` instead of `categories`:

```typescript
      <div className="flex w-full min-w-0 flex-col gap-1 sm:w-auto">
        <label className="text-xs text-muted-foreground">Categoria</label>
        <Select
          value={categoryId}
          onValueChange={(value) => {
            if (value === null) return;
            setCategoryIdOverride(value);
          }}
          disabled={availableCategories.length === 0}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Categoria">
              {(value: string | null) => availableCategories.find((c) => c.id === value)?.name ?? ""}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {availableCategories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
```

And update the "Nessuna categoria disponibile" warning message (lines 178-182) to use `availableCategories`:

```typescript
      {availableCategories.length === 0 && (
        <p className="w-full text-sm text-muted-foreground">
          {direction === "entrata"
            ? "Nessuna categoria di entrata disponibile: aggiungine una dalla pagina Categorie."
            : "Nessuna categoria disponibile: aggiungine una prima di registrare una spesa."}
        </p>
      )}
```

Finally, also reset `direction` to `"spesa"` in the mutation's `onSuccess` (inside `handleSubmit`, next to `setDescription("")`/`setAmountValue(null)`):

```typescript
        onSuccess: () => {
          setDescription("");
          setAmountValue(null);
          setDate(todayDateString());
          setDirection("spesa");
        },
```

- [ ] **Step 2: Type check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/domain/expenses/add-transaction-form.tsx
git commit -m "feat: form Aggiungi transazione supporta la creazione di entrate"
```

---

### Task 6: Transaction row — category filtered by direction, no "Dividi" on income

**Files:**
- Modify: `components/domain/expenses/transaction-row.tsx`

**Interfaces:**
- Consumes: `Category["type"]`, inline `isIncome` equivalent (same criterion `amount > 0`).
- Produces: no new public prop.

- [ ] **Step 1: Implement**

In `components/domain/expenses/transaction-row.tsx`, replace lines 46-55:

```typescript
  const excludedAmount = Math.abs(Number(transaction.excludedAmount));
  const fullAmount = Math.abs(Number(transaction.amount));
  const netAmount = fullAmount - excludedAmount;
  const isSplit = excludedAmount > 0;
  const isIncome = Number(transaction.amount) > 0;
  const currentCategory = categories.find((c) => c.id === transaction.categoryId);
  const isUncategorized = currentCategory?.isFallback ?? false;
  const sortedCategories = React.useMemo(
    () =>
      categories
        .filter((c) => c.isFallback || (isIncome ? c.type === "entrata" : c.type !== "entrata"))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [categories, isIncome]
  );
```

And hide the "Dividi" button for income transactions: replace lines 220-227:

```typescript
          {!isIncome && (
            <button
              type="button"
              onClick={() => setSplitOpen((open) => !open)}
              className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
              aria-pressed={splitOpen}
            >
              Dividi
            </button>
          )}
```

And the conditional rendering of `SplitSlider` at the bottom (lines 259-261) stays unchanged (already conditioned by `splitOpen`, which now can no longer become `true` for an income row since the button that activates it is hidden).

- [ ] **Step 2: Type check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/domain/expenses/transaction-row.tsx
git commit -m "feat: riga transazione filtra la categoria per direzione e nasconde Dividi sulle entrate"
```

---

### Task 7: List type toggle + Transazioni page (rebrand of Spese)

**Files:**
- Create: `components/domain/expenses/transactions-type-toggle.tsx`
- Modify: `components/domain/expenses/index.ts`
- Modify: `app/(app)/spese/page.tsx`
- Modify: `components/layout/sidebar.tsx`

**Interfaces:**
- Consumes: `TransactionDirection`, `filterByTransactionType`, `isExpense` (Task 2); `useTransactionsQuery(from, to, "tutte")` (Task 4).
- Produces: `TransactionsTypeToggle` exported from the `components/domain/expenses` barrel.

- [ ] **Step 1: Create the toggle**

Create `components/domain/expenses/transactions-type-toggle.tsx`:

```typescript
"use client";

/** Tutte/Uscite/Entrate toggle for the transaction list (does not affect KPI/donut/trend, always outflows-only). */

import { cn } from "@/lib/utils";
import type { TransactionDirection } from "@/lib/calc/expenses";

const OPTIONS: { value: TransactionDirection; label: string }[] = [
  { value: "tutte", label: "Tutte" },
  { value: "uscita", label: "Uscite" },
  { value: "entrata", label: "Entrate" },
];

export interface TransactionsTypeToggleProps {
  value: TransactionDirection;
  onChange: (direction: TransactionDirection) => void;
}

export function TransactionsTypeToggle({ value, onChange }: TransactionsTypeToggleProps) {
  return (
    <div className="inline-flex w-fit items-center gap-1 rounded-lg bg-muted p-1">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            value === option.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
```

Add to the barrel `components/domain/expenses/index.ts` (after the `AutoCategorizeWizard` export):

```typescript
export { TransactionsTypeToggle } from "./transactions-type-toggle";
export type { TransactionsTypeToggleProps } from "./transactions-type-toggle";
```

- [ ] **Step 2: Rename the navigation entry**

In `components/layout/sidebar.tsx`, line 70, change:

```typescript
  { label: "Transazioni", href: "/spese", icon: ShoppingCart },
```

- [ ] **Step 3: Page wiring**

In `app/(app)/spese/page.tsx`, replace the whole file:

```typescript
"use client";

/** Transazioni page (formerly Spese): orchestrates period, KPIs, charts, categories/budget, transaction list and add form. */

import * as React from "react";
import {
  AddTransactionForm,
  AutoCategorizeButton,
  CategoryBreakdownDonut,
  ExpensesFilterBar,
  ExpensesKpiCards,
  ExpensesPeriodSelector,
  ExpensesReferenceNav,
  ExpenseTrendChart,
  TransactionRow,
  TransactionsTypeToggle,
} from "@/components/domain/expenses";
import { Card } from "@/components/ui/card";
import { authClient } from "@/lib/auth/client";
import {
  computeCategoryBreakdown,
  computeCategoryMonthlyStacks,
  computeFixedVsVariable,
  computeSummary,
  filterByTransactionType,
  filterTransactions,
  getPeriodRange,
  isExpense,
  type ExpensePeriod,
  type TransactionDirection,
} from "@/lib/calc/expenses";
import { formatCurrency } from "@/lib/format";
import { useBudgetsQuery } from "@/lib/queries/budgets";
import { useCategoriesQuery } from "@/lib/queries/categories";
import { useTransactionsQuery } from "@/lib/queries/transactions";

function toDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Fetch window: from January 1 of the previous year to December 31 of the current one — covers "anno", the comparison with the previous period and the 6-month trend. */
function fetchWindow(referenceDate: Date): { from: string; to: string } {
  const from = new Date(referenceDate.getFullYear() - 1, 0, 1);
  const to = new Date(referenceDate.getFullYear(), 11, 31);
  return { from: toDateString(from), to: toDateString(to) };
}

export default function SpesePage() {
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const [referenceDate, setReferenceDate] = React.useState<Date>(() => new Date());
  const today = React.useMemo(() => new Date(), []);
  const [period, setPeriod] = React.useState<ExpensePeriod>("mese");
  const [showUncategorizedOnly, setShowUncategorizedOnly] = React.useState(false);
  const [categoryFilter, setCategoryFilter] = React.useState<string | null>(null);
  const [searchText, setSearchText] = React.useState("");
  const [listTypeFilter, setListTypeFilter] = React.useState<TransactionDirection>("uscita");

  const { from, to } = fetchWindow(referenceDate);
  const { data: transactions, isLoading, isError, refetch } = useTransactionsQuery(from, to, "tutte");
  const { data: categories } = useCategoriesQuery();
  const { data: budgets } = useBudgetsQuery();

  const safeTransactions = transactions ?? [];
  const safeCategories = categories ?? [];
  const safeBudgets = budgets ?? [];

  const filteredTransactions = filterTransactions(safeTransactions, {
    categoryId: categoryFilter,
    searchText,
  });

  // Analysis widgets (KPI/donut/trend): always and only outflows, regardless of the list-type toggle.
  const expenseTransactionsForAnalysis = filteredTransactions.filter(isExpense);
  const filteredBudgets = categoryFilter
    ? safeBudgets.filter((b) => b.categoryId === categoryFilter)
    : safeBudgets;

  // List: respects the Tutte/Uscite/Entrate toggle.
  const listFiltered = filterByTransactionType(filteredTransactions, listTypeFilter);

  const fallbackCategoryIds = new Set(
    safeCategories.filter((c) => c.isFallback).map((c) => c.id)
  );

  const range = getPeriodRange(period, referenceDate);
  const transactionsInPeriodAll = listFiltered.filter(
    (t) => t.date >= toDateString(range.from) && t.date <= toDateString(range.to)
  );
  const uncategorizedCount = transactionsInPeriodAll.filter(
    (t) => t.categoryId !== null && fallbackCategoryIds.has(t.categoryId)
  ).length;
  const transactionsInPeriod = showUncategorizedOnly
    ? transactionsInPeriodAll.filter((t) => t.categoryId !== null && fallbackCategoryIds.has(t.categoryId))
    : transactionsInPeriodAll;

  const hasActiveFilter = categoryFilter !== null || searchText.trim() !== "";

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-medium text-foreground">Transazioni</h1>
          <ExpensesReferenceNav period={period} referenceDate={referenceDate} onChange={setReferenceDate} />
        </div>
        <a
          href="/categorie"
          className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Gestisci categorie
        </a>
        <AutoCategorizeButton categories={safeCategories} currency={currency} />
        {uncategorizedCount > 0 && (
          <button
            type="button"
            onClick={() => setShowUncategorizedOnly((v) => !v)}
            aria-pressed={showUncategorizedOnly}
            className={
              showUncategorizedOnly
                ? "flex items-center gap-1.5 rounded-full border border-neg/40 bg-neg-soft px-3 py-1 text-sm font-medium text-neg"
                : "flex items-center gap-1.5 rounded-full border border-neg/40 px-3 py-1 text-sm font-medium text-neg hover:bg-neg-soft/50"
            }
          >
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-neg opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-neg" />
            </span>
            Da categorizzare ({uncategorizedCount})
          </button>
        )}
        <ExpensesPeriodSelector value={period} onChange={setPeriod} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ExpensesFilterBar
          categories={safeCategories}
          categoryId={categoryFilter}
          onCategoryChange={(categoryId) => {
            setCategoryFilter(categoryId);
            setShowUncategorizedOnly(false);
          }}
          searchText={searchText}
          onSearchTextChange={setSearchText}
        />
        <TransactionsTypeToggle value={listTypeFilter} onChange={setListTypeFilter} />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Impossibile caricare le transazioni.{" "}
          <button onClick={() => refetch()} className="underline underline-offset-2">
            Riprova
          </button>
        </div>
      ) : (
        <>
          <ExpensesKpiCards
            transactions={expenseTransactionsForAnalysis}
            budgets={filteredBudgets}
            period={period}
            currency={currency}
            referenceDate={referenceDate}
            today={today}
          />

          <CategoryBreakdownDonut
            categoryAmounts={computeCategoryBreakdown(expenseTransactionsForAnalysis, safeCategories, period, referenceDate, today)}
            fixedVsVariable={computeFixedVsVariable(expenseTransactionsForAnalysis, safeCategories, period, referenceDate, today)}
            budgets={safeBudgets}
            currency={currency}
          />

          <Card className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 text-sm text-muted-foreground">
              {(() => {
                const summary = computeSummary(expenseTransactionsForAnalysis, range);
                return (
                  <>
                    <span>Uscite: {formatCurrency(summary.uscite, currency)}</span>
                    <span>Escluse: {formatCurrency(summary.escluse, currency)}</span>
                    <span className="font-medium text-foreground">
                      Spese effettive: {formatCurrency(summary.speseEffettive, currency)}
                    </span>
                  </>
                );
              })()}
            </div>
            {transactionsInPeriod.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                {showUncategorizedOnly
                  ? "Nessuna transazione da categorizzare in questo periodo."
                  : hasActiveFilter
                    ? "Nessuna transazione corrisponde ai filtri applicati in questo periodo."
                    : "Nessuna transazione in questo periodo. Aggiungine una dal form qui sotto."}
              </p>
            ) : (
              transactionsInPeriod.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  categories={safeCategories}
                  currency={currency}
                />
              ))
            )}
            <AddTransactionForm categories={safeCategories} currency={currency} />
          </Card>

          <ExpenseTrendChart
            monthlyStacks={computeCategoryMonthlyStacks(expenseTransactionsForAnalysis, safeCategories, referenceDate)}
            currency={currency}
          />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Type check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/domain/expenses/transactions-type-toggle.tsx components/domain/expenses/index.ts app/\(app\)/spese/page.tsx components/layout/sidebar.tsx
git commit -m "feat: rinomina Spese in Transazioni, aggiungi toggle tipo lista"
```

---

### Task 8: Cash flow calculation engine

**Files:**
- Create: `lib/calc/cashflow.ts`
- Create: `lib/calc/cashflow.test.ts`

**Interfaces:**
- Consumes: `Transaction`, `Category` (schema); `isExpense`, `isIncome`, `MONTH_LABELS`, `parseDateOnly`, `startOfDay`, `startOfMonth`, `endOfMonth`, `addMonths`, `type DateRange` from `lib/calc/expenses.ts` (Task 2).
- Produces: `type CashflowPeriod`; `getCashflowPeriodRange`; `getPreviousCashflowPeriodRange`; `shiftCashflowReferenceDate`; `formatCashflowPeriodLabel`; `computeCashflowKpis`; `computeMonthlySeries`; `computeIncomeSources`; `computeWhereItGoes`; `computeAccumulatedSavings` — all used by Tasks 9-11.

- [ ] **Step 1: Write the test**

Create `lib/calc/cashflow.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  computeAccumulatedSavings,
  computeCashflowKpis,
  computeIncomeSources,
  computeMonthlySeries,
  computeWhereItGoes,
  formatCashflowPeriodLabel,
  getCashflowPeriodRange,
  getPreviousCashflowPeriodRange,
  shiftCashflowReferenceDate,
} from "./cashflow";
import type { Transaction } from "@/lib/db/schema/transactions";
import type { Category } from "@/lib/db/schema/categories";

function makeTransaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: crypto.randomUUID(),
    userId: "user-1",
    accountId: "account-1",
    categoryId: "category-1",
    description: "Transazione",
    amount: "-10.00",
    excludedAmount: "0.00",
    date: "2026-02-10",
    source: "manuale",
    externalId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

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

describe("getCashflowPeriodRange", () => {
  it("'3mesi' copre il mese di riferimento e i 2 precedenti", () => {
    const range = getCashflowPeriodRange("3mesi", new Date(2026, 2, 15)); // March 15, 2026
    expect(range.from).toEqual(new Date(2026, 0, 1)); // January 1
    expect(range.to).toEqual(new Date(2026, 2, 31)); // March 31
  });

  it("'12mesi' copre 12 mesi calendariali fino al mese di riferimento incluso", () => {
    const range = getCashflowPeriodRange("12mesi", new Date(2026, 2, 15));
    expect(range.from).toEqual(new Date(2025, 3, 1)); // April 2025
    expect(range.to).toEqual(new Date(2026, 2, 31));
  });
});

describe("getPreviousCashflowPeriodRange / shiftCashflowReferenceDate", () => {
  it("il periodo precedente di '3mesi' è spostato indietro di 3 mesi", () => {
    const previous = getPreviousCashflowPeriodRange("3mesi", new Date(2026, 2, 15));
    expect(previous.from).toEqual(new Date(2025, 9, 1)); // October 2025
    expect(previous.to).toEqual(new Date(2025, 11, 31)); // December 31, 2025
  });

  it("shiftCashflowReferenceDate avanti di '6mesi' sposta di 6 mesi", () => {
    const shifted = shiftCashflowReferenceDate("6mesi", new Date(2026, 2, 15), 1);
    expect(shifted).toEqual(new Date(2026, 8, 15));
  });
});

describe("formatCashflowPeriodLabel", () => {
  it("formatta un range nello stesso anno come 'Mmm – Mmm AAAA'", () => {
    const range = getCashflowPeriodRange("3mesi", new Date(2026, 2, 15));
    expect(formatCashflowPeriodLabel(range)).toBe("Gen – Mar 2026");
  });
});

describe("computeCashflowKpis", () => {
  const range = { from: new Date(2026, 0, 1), to: new Date(2026, 1, 28) }; // Jan-Feb 2026

  it("calcola entrate/uscite medie, flusso netto e tasso di risparmio", () => {
    const transactions = [
      makeTransaction({ amount: "1500.00", date: "2026-01-05" }),
      makeTransaction({ amount: "-500.00", date: "2026-01-10" }),
      makeTransaction({ amount: "1500.00", date: "2026-02-05" }),
      makeTransaction({ amount: "-700.00", date: "2026-02-10" }),
    ];

    const kpis = computeCashflowKpis(transactions, range);

    expect(kpis.entrateMedie).toBe(1500);
    expect(kpis.usciteMedie).toBe(600);
    expect(kpis.flussoNetto).toBe(1800);
    expect(kpis.tassoRisparmio).toBeCloseTo(1800 / 3000);
  });

  it("tassoRisparmio è null quando le entrate sono zero", () => {
    const transactions = [makeTransaction({ amount: "-500.00", date: "2026-01-10" })];
    const kpis = computeCashflowKpis(transactions, range);
    expect(kpis.tassoRisparmio).toBeNull();
  });
});

describe("computeMonthlySeries", () => {
  it("include un mese senza transazioni con entrate/uscite a 0", () => {
    const range = { from: new Date(2026, 0, 1), to: new Date(2026, 1, 28) };
    const transactions = [makeTransaction({ amount: "1000.00", date: "2026-01-05" })];

    const series = computeMonthlySeries(transactions, range);

    expect(series).toHaveLength(2);
    expect(series[0]).toMatchObject({ month: 0, entrate: 1000, uscite: 0 });
    expect(series[1]).toMatchObject({ month: 1, entrate: 0, uscite: 0 });
  });
});

describe("computeIncomeSources", () => {
  it("ordina le fonti per importo decrescente con quota % sul totale", () => {
    const range = { from: new Date(2026, 0, 1), to: new Date(2026, 0, 31) };
    const stipendio = makeCategory({ id: "cat-stipendio", name: "Stipendio", type: "entrata" });
    const freelance = makeCategory({ id: "cat-freelance", name: "Freelance", type: "entrata" });
    const transactions = [
      makeTransaction({ categoryId: "cat-stipendio", amount: "1500.00", date: "2026-01-05" }),
      makeTransaction({ categoryId: "cat-freelance", amount: "500.00", date: "2026-01-10" }),
    ];

    const sources = computeIncomeSources(transactions, [stipendio, freelance], range);

    expect(sources.map((s) => s.categoryId)).toEqual(["cat-stipendio", "cat-freelance"]);
    expect(sources[0].quotaPct).toBeCloseTo(75);
    expect(sources[1].quotaPct).toBeCloseTo(25);
  });

  it("esclude una fonte con importo zero nel periodo", () => {
    const range = { from: new Date(2026, 0, 1), to: new Date(2026, 0, 31) };
    const stipendio = makeCategory({ id: "cat-stipendio", name: "Stipendio", type: "entrata" });
    const dividendi = makeCategory({ id: "cat-dividendi", name: "Dividendi", type: "entrata" });
    const transactions = [makeTransaction({ categoryId: "cat-stipendio", amount: "1500.00", date: "2026-01-05" })];

    const sources = computeIncomeSources(transactions, [stipendio, dividendi], range);

    expect(sources.map((s) => s.categoryId)).toEqual(["cat-stipendio"]);
  });
});

describe("computeWhereItGoes", () => {
  it("calcola fisse/variabili/risparmio del mese di riferimento con quote sul totale entrate", () => {
    const fissa = makeCategory({ id: "cat-fissa", type: "fissa" });
    const variabile = makeCategory({ id: "cat-variabile", type: "variabile" });
    const transactions = [
      makeTransaction({ categoryId: "cat-fissa", amount: "-400.00", date: "2026-02-05" }),
      makeTransaction({ categoryId: "cat-variabile", amount: "-300.00", date: "2026-02-10" }),
      makeTransaction({ categoryId: "category-1", amount: "1500.00", date: "2026-02-01" }),
    ];

    const entries = computeWhereItGoes(transactions, [fissa, variabile], new Date(2026, 1, 15));

    expect(entries.find((e) => e.key === "fisse")?.amount).toBe(400);
    expect(entries.find((e) => e.key === "fisse")?.quotaPct).toBeCloseTo((400 / 1500) * 100);
    expect(entries.find((e) => e.key === "variabili")?.amount).toBe(300);
    expect(entries.find((e) => e.key === "risparmio")?.amount).toBe(800);
  });

  it("il risparmio può essere negativo se si spende più di quanto entra", () => {
    const fissa = makeCategory({ id: "cat-fissa", type: "fissa" });
    const transactions = [
      makeTransaction({ categoryId: "cat-fissa", amount: "-2000.00", date: "2026-02-05" }),
      makeTransaction({ categoryId: "category-1", amount: "1500.00", date: "2026-02-01" }),
    ];

    const entries = computeWhereItGoes(transactions, [fissa], new Date(2026, 1, 15));

    expect(entries.find((e) => e.key === "risparmio")?.amount).toBe(-500);
  });

  it("quotaPct è null quando le entrate del mese sono zero", () => {
    const fissa = makeCategory({ id: "cat-fissa", type: "fissa" });
    const transactions = [makeTransaction({ categoryId: "cat-fissa", amount: "-200.00", date: "2026-02-05" })];

    const entries = computeWhereItGoes(transactions, [fissa], new Date(2026, 1, 15));

    expect(entries.every((e) => e.quotaPct === null)).toBe(true);
  });
});

describe("computeAccumulatedSavings", () => {
  it("somma cumulativamente il flusso netto mese su mese, anche quando negativo", () => {
    const range = { from: new Date(2026, 0, 1), to: new Date(2026, 2, 31) };
    const transactions = [
      makeTransaction({ amount: "1000.00", date: "2026-01-05" }),
      makeTransaction({ amount: "-1500.00", date: "2026-02-05" }),
      makeTransaction({ amount: "500.00", date: "2026-03-05" }),
    ];

    const result = computeAccumulatedSavings(transactions, range);

    expect(result.map((e) => e.cumulative)).toEqual([1000, -500, 0]);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm test lib/calc/cashflow.test.ts`
Expected: FAIL — `lib/calc/cashflow.ts` does not exist yet.

- [ ] **Step 3: Implement**

Create `lib/calc/cashflow.ts`:

```typescript
import type { Transaction } from "@/lib/db/schema/transactions";
import type { Category } from "@/lib/db/schema/categories";
import {
  addMonths,
  endOfMonth,
  isExpense,
  isIncome,
  MONTH_LABELS,
  parseDateOnly,
  startOfMonth,
  type DateRange,
} from "./expenses";

/** Selectable period in the Cash flow screen. */
export type CashflowPeriod = "3mesi" | "6mesi" | "12mesi" | "24mesi";

const PERIOD_MONTHS: Record<CashflowPeriod, number> = {
  "3mesi": 3,
  "6mesi": 6,
  "12mesi": 12,
  "24mesi": 24,
};

function isWithinRange(date: Date, range: DateRange): boolean {
  return date.getTime() >= range.from.getTime() && date.getTime() <= range.to.getTime();
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function monthsInRange(range: DateRange): Date[] {
  const months: Date[] = [];
  let cursor = startOfMonth(range.from);
  const end = startOfMonth(range.to);
  while (cursor.getTime() <= end.getTime()) {
    months.push(cursor);
    cursor = addMonths(cursor, 1);
  }
  return months;
}

/** Calendar range of the Cash flow period: `months` calendar months up to and including `referenceDate`. */
export function getCashflowPeriodRange(period: CashflowPeriod, referenceDate: Date): DateRange {
  const months = PERIOD_MONTHS[period];
  return { from: startOfMonth(addMonths(referenceDate, -(months - 1))), to: endOfMonth(referenceDate) };
}

/** Range of equal length immediately preceding the selected Cash flow period. */
export function getPreviousCashflowPeriodRange(period: CashflowPeriod, referenceDate: Date): DateRange {
  const months = PERIOD_MONTHS[period];
  return getCashflowPeriodRange(period, addMonths(referenceDate, -months));
}

/** Shifts referenceDate by one Cash flow period unit (forward if direction=1, backward if direction=-1). */
export function shiftCashflowReferenceDate(period: CashflowPeriod, referenceDate: Date, direction: 1 | -1): Date {
  const months = PERIOD_MONTHS[period];
  return addMonths(referenceDate, months * direction);
}

/** Readable label of the Cash flow period, e.g. "Gen – Mar 2026" or "Gen 2025 – Dic 2026". */
export function formatCashflowPeriodLabel(range: DateRange): string {
  const sameYear = range.from.getFullYear() === range.to.getFullYear();
  const monthYearFormat = new Intl.DateTimeFormat("it-IT", { month: "short", year: "numeric" });
  if (sameYear) {
    const monthOnly = new Intl.DateTimeFormat("it-IT", { month: "short" }).format(range.from);
    return `${capitalize(monthOnly)} – ${capitalize(monthYearFormat.format(range.to))}`;
  }
  return `${capitalize(monthYearFormat.format(range.from))} – ${capitalize(monthYearFormat.format(range.to))}`;
}

export interface CashflowKpis {
  entrateMedie: number;
  usciteMedie: number;
  flussoNetto: number;
  /** null if income in the period is zero (cannot be computed). */
  tassoRisparmio: number | null;
}

/** Main Cash flow KPIs: average monthly income/outflows, net flow, savings rate over the selected period. */
export function computeCashflowKpis(transactions: Transaction[], range: DateRange): CashflowKpis {
  const inRange = transactions.filter((t) => isWithinRange(parseDateOnly(t.date), range));
  const entrate = inRange.filter(isIncome).reduce((sum, t) => sum + Number(t.amount), 0);
  const uscite = inRange.filter(isExpense).reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
  const monthCount = monthsInRange(range).length;

  const flussoNetto = entrate - uscite;
  return {
    entrateMedie: entrate / monthCount,
    usciteMedie: uscite / monthCount,
    flussoNetto,
    tassoRisparmio: entrate > 0 ? flussoNetto / entrate : null,
  };
}

export interface CashflowMonthlyEntry {
  year: number;
  month: number;
  label: string;
  entrate: number;
  uscite: number;
}

/** Monthly income/outflow series for each calendar month in the range (including months without transactions, at 0). */
export function computeMonthlySeries(transactions: Transaction[], range: DateRange): CashflowMonthlyEntry[] {
  return monthsInRange(range).map((monthDate) => {
    const monthRange: DateRange = { from: startOfMonth(monthDate), to: endOfMonth(monthDate) };
    const inMonth = transactions.filter((t) => isWithinRange(parseDateOnly(t.date), monthRange));
    return {
      year: monthDate.getFullYear(),
      month: monthDate.getMonth(),
      label: MONTH_LABELS[monthDate.getMonth()],
      entrate: inMonth.filter(isIncome).reduce((sum, t) => sum + Number(t.amount), 0),
      uscite: inMonth.filter(isExpense).reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0),
    };
  });
}

export interface IncomeSourceAmount {
  categoryId: string;
  name: string;
  color: string;
  icon: string;
  amount: number;
  /** null if total income in the period is zero (cannot be computed). */
  quotaPct: number | null;
}

/** Income by "entrata"-type category in the period, sorted descending, with % share of total income. Excludes zero-amount sources. */
export function computeIncomeSources(
  transactions: Transaction[],
  categories: Category[],
  range: DateRange
): IncomeSourceAmount[] {
  const incomeCategories = categories.filter((c) => c.type === "entrata");
  const inRange = transactions.filter((t) => isWithinRange(parseDateOnly(t.date), range) && isIncome(t));
  const totalEntrate = inRange.reduce((sum, t) => sum + Number(t.amount), 0);

  return incomeCategories
    .map((category) => {
      const amount = inRange
        .filter((t) => t.categoryId === category.id)
        .reduce((sum, t) => sum + Number(t.amount), 0);
      return {
        categoryId: category.id,
        name: category.name,
        color: category.color,
        icon: category.icon,
        amount,
        quotaPct: totalEntrate > 0 ? (amount / totalEntrate) * 100 : null,
      };
    })
    .filter((entry) => entry.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

export interface WhereItGoesEntry {
  key: "fisse" | "variabili" | "risparmio";
  label: string;
  amount: number;
  /** null if the month's income is zero (cannot be computed). Savings can be negative (no floor at zero). */
  quotaPct: number | null;
}

/** "Dove va ogni euro" for the reference month: fixed expenses, variable expenses, savings (income - fixed - variable), with % share of total income. */
export function computeWhereItGoes(
  transactions: Transaction[],
  categories: Category[],
  referenceDate: Date
): WhereItGoesEntry[] {
  const monthRange: DateRange = { from: startOfMonth(referenceDate), to: endOfMonth(referenceDate) };
  const inMonth = transactions.filter((t) => isWithinRange(parseDateOnly(t.date), monthRange));
  const categoryTypeById = new Map(categories.map((c) => [c.id, c.type] as const));

  const entrate = inMonth.filter(isIncome).reduce((sum, t) => sum + Number(t.amount), 0);
  const fisse = inMonth
    .filter((t) => isExpense(t) && categoryTypeById.get(t.categoryId) === "fissa")
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
  const variabili = inMonth
    .filter((t) => isExpense(t) && categoryTypeById.get(t.categoryId) === "variabile")
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
  const risparmio = entrate - fisse - variabili;

  const quotaOf = (amount: number) => (entrate > 0 ? (amount / entrate) * 100 : null);
  return [
    { key: "fisse", label: "Spese fisse", amount: fisse, quotaPct: quotaOf(fisse) },
    { key: "variabili", label: "Spese variabili", amount: variabili, quotaPct: quotaOf(variabili) },
    { key: "risparmio", label: "Risparmio", amount: risparmio, quotaPct: quotaOf(risparmio) },
  ];
}

export interface AccumulatedSavingsEntry {
  year: number;
  month: number;
  label: string;
  cumulative: number;
}

/** Month-over-month cumulative sum of the net flow (income - outflows) over the selected range. */
export function computeAccumulatedSavings(transactions: Transaction[], range: DateRange): AccumulatedSavingsEntry[] {
  const monthly = computeMonthlySeries(transactions, range);
  let running = 0;
  return monthly.map((entry) => {
    running += entry.entrate - entry.uscite;
    return { year: entry.year, month: entry.month, label: entry.label, cumulative: running };
  });
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm test lib/calc/cashflow.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/calc/cashflow.ts lib/calc/cashflow.test.ts
git commit -m "feat: motore di calcolo puro per la schermata Cash flow"
```

---

### Task 9: Cash flow components — header (period selector, reference nav, KPI cards)

**Files:**
- Create: `components/domain/cashflow/cashflow-period-selector.tsx`
- Create: `components/domain/cashflow/cashflow-reference-nav.tsx`
- Create: `components/domain/cashflow/cashflow-kpi-cards.tsx`
- Create: `components/domain/cashflow/index.ts`

**Interfaces:**
- Consumes: `CashflowPeriod`, `getCashflowPeriodRange`, `shiftCashflowReferenceDate`, `formatCashflowPeriodLabel`, `computeCashflowKpis` (Task 8).
- Produces: `CashflowPeriodSelector`, `CashflowReferenceNav`, `CashflowKpiCards` exported from the `components/domain/cashflow` barrel, used by Task 11.

- [ ] **Step 1: Create the period selector**

Create `components/domain/cashflow/cashflow-period-selector.tsx`:

```typescript
"use client";

/** 3M/6M/12M/24M period selector for the Cash flow screen (same pill pattern as ExpensesPeriodSelector). */

import { cn } from "@/lib/utils";
import type { CashflowPeriod } from "@/lib/calc/cashflow";

const PERIOD_OPTIONS: { value: CashflowPeriod; label: string }[] = [
  { value: "3mesi", label: "3M" },
  { value: "6mesi", label: "6M" },
  { value: "12mesi", label: "12M" },
  { value: "24mesi", label: "24M" },
];

export interface CashflowPeriodSelectorProps {
  value: CashflowPeriod;
  onChange: (period: CashflowPeriod) => void;
}

export function CashflowPeriodSelector({ value, onChange }: CashflowPeriodSelectorProps) {
  return (
    <div className="inline-flex w-fit items-center gap-1 rounded-lg bg-muted p-1">
      {PERIOD_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            value === option.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create the period navigation**

Create `components/domain/cashflow/cashflow-reference-nav.tsx`:

```typescript
"use client";

/** Cash flow period navigation: prev/next arrows only (no direct jump to month/year, unlike Transazioni). */

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatCashflowPeriodLabel,
  getCashflowPeriodRange,
  shiftCashflowReferenceDate,
  type CashflowPeriod,
} from "@/lib/calc/cashflow";
import { startOfDay } from "@/lib/calc/expenses";

export interface CashflowReferenceNavProps {
  period: CashflowPeriod;
  referenceDate: Date;
  onChange: (newReferenceDate: Date) => void;
}

export function CashflowReferenceNav({ period, referenceDate, onChange }: CashflowReferenceNavProps) {
  const today = startOfDay(new Date());
  const range = getCashflowPeriodRange(period, referenceDate);
  const isNextDisabled = range.to.getTime() >= today.getTime();

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(shiftCashflowReferenceDate(period, referenceDate, -1))}
        aria-label="Periodo precedente"
        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ChevronLeftIcon className="size-4" />
      </button>

      <span className="min-w-[9rem] px-2 py-1 text-center text-sm text-muted-foreground">
        {formatCashflowPeriodLabel(range)}
      </span>

      <button
        type="button"
        onClick={() => onChange(shiftCashflowReferenceDate(period, referenceDate, 1))}
        disabled={isNextDisabled}
        aria-label="Periodo successivo"
        className={cn(
          "rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground",
          isNextDisabled && "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-muted-foreground"
        )}
      >
        <ChevronRightIcon className="size-4" />
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Create the KPI cards**

Create `components/domain/cashflow/cashflow-kpi-cards.tsx`:

```typescript
/** 4 Cash flow KPIs: average income, average outflows, net flow, savings rate. */

import { StatCard } from "@/components/domain/stat-card";
import { computeCashflowKpis, getCashflowPeriodRange, type CashflowPeriod } from "@/lib/calc/cashflow";
import type { Transaction } from "@/lib/db/schema/transactions";

export interface CashflowKpiCardsProps {
  transactions: Transaction[];
  period: CashflowPeriod;
  currency: string;
  referenceDate: Date;
}

export function CashflowKpiCards({ transactions, period, currency, referenceDate }: CashflowKpiCardsProps) {
  const range = getCashflowPeriodRange(period, referenceDate);
  const kpis = computeCashflowKpis(transactions, range);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
      <StatCard label="Entrate medie" value={kpis.entrateMedie} currency={currency} />
      <StatCard label="Uscite medie" value={-kpis.usciteMedie} currency={currency} />
      <StatCard label="Flusso netto" value={kpis.flussoNetto} currency={currency} />
      <StatCard
        label="Tasso di risparmio"
        value={kpis.tassoRisparmio ?? 0}
        currency={currency}
        subtitle={
          kpis.tassoRisparmio === null
            ? "Non calcolabile (nessuna entrata nel periodo)"
            : `${Math.round(kpis.tassoRisparmio * 100)}% delle entrate`
        }
      />
    </div>
  );
}
```

Note: `StatCard` always formats `value` as currency; for "Tasso di risparmio" ("Savings rate") the numeric value shown as the big figure is misleading (it is a KPI card that reuses `StatCard` only for visual layout consistency — the readable figure is in the `subtitle`). This is accepted for consistency with the other 3 cards; do not introduce a `StatCard` variant for a single use case (YAGNI).

No need to update the signature of `computeCashflowKpis` — no change to `cashflow.ts` in this task.

- [ ] **Step 4: Create the barrel**

Create `components/domain/cashflow/index.ts`:

```typescript
/**
 * components/domain/cashflow — barrel file
 *
 * Single entry point for the components of the Cash flow screen.
 */

export { CashflowPeriodSelector } from "./cashflow-period-selector";
export type { CashflowPeriodSelectorProps } from "./cashflow-period-selector";
export { CashflowReferenceNav } from "./cashflow-reference-nav";
export type { CashflowReferenceNavProps } from "./cashflow-reference-nav";
export { CashflowKpiCards } from "./cashflow-kpi-cards";
export type { CashflowKpiCardsProps } from "./cashflow-kpi-cards";
```

- [ ] **Step 5: Type check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/domain/cashflow/cashflow-period-selector.tsx components/domain/cashflow/cashflow-reference-nav.tsx components/domain/cashflow/cashflow-kpi-cards.tsx components/domain/cashflow/index.ts
git commit -m "feat: componenti header Cash flow (selettore periodo, nav, KPI)"
```

---

### Task 10: Cash flow components — charts and lists

**Files:**
- Create: `components/domain/cashflow/cashflow-trend-chart.tsx`
- Create: `components/domain/cashflow/income-sources-list.tsx`
- Create: `components/domain/cashflow/where-it-goes-breakdown.tsx`
- Create: `components/domain/cashflow/accumulated-savings-chart.tsx`
- Modify: `components/domain/cashflow/index.ts`

**Interfaces:**
- Consumes: `computeMonthlySeries`, `computeIncomeSources`, `computeWhereItGoes`, `computeAccumulatedSavings` and the related types (Task 8); `CategoryAvatar`, `ICON_MAP` (`components/domain/categories`); `SWATCH_CHART_COLOR` (`components/domain/shared/color-swatches`).
- Produces: `CashflowTrendChart`, `IncomeSourcesList`, `WhereItGoesBreakdown`, `AccumulatedSavingsChart` exported from the barrel, used by Task 11.

- [ ] **Step 1: Income vs outflows chart**

Create `components/domain/cashflow/cashflow-trend-chart.tsx`:

```typescript
"use client";

/** "Entrate vs uscite" chart: side-by-side (not stacked) bars for each month of the selected period. */

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/format";
import type { CashflowMonthlyEntry } from "@/lib/calc/cashflow";

const CHART_CONFIG = {
  entrate: { label: "Entrate", color: "var(--pos)" },
  uscite: { label: "Uscite", color: "var(--neg)" },
} satisfies ChartConfig;

export interface CashflowTrendChartProps {
  monthlySeries: CashflowMonthlyEntry[];
  currency: string;
}

export function CashflowTrendChart({ monthlySeries, currency }: CashflowTrendChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Entrate vs uscite
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={CHART_CONFIG} className="max-h-64 w-full">
          <BarChart data={monthlySeries}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => formatCurrency(Number(value), currency, { maximumFractionDigits: 0 })}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => (
                    <div className="flex w-full items-center justify-between gap-3">
                      <span className="text-muted-foreground">{name === "entrate" ? "Entrate" : "Uscite"}</span>
                      <span className="font-mono font-medium tabular-nums text-foreground">
                        {formatCurrency(Number(value), currency)}
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Bar dataKey="entrate" fill="var(--color-entrate)" radius={4} />
            <Bar dataKey="uscite" fill="var(--color-uscite)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Income sources list**

Create `components/domain/cashflow/income-sources-list.tsx`:

```typescript
/** "Fonti di entrata" block: one row per income-type category, with amount and % share of the period's total income. */

import { CategoryAvatar } from "@/components/domain/categories";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { IncomeSourceAmount } from "@/lib/calc/cashflow";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";

export interface IncomeSourcesListProps {
  sources: IncomeSourceAmount[];
  currency: string;
}

export function IncomeSourcesList({ sources, currency }: IncomeSourcesListProps) {
  return (
    <Card className="p-0">
      <CardHeader className="pt-4">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Fonti di entrata
        </CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border p-0">
        {sources.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Nessuna entrata registrata in questo periodo.</p>
        ) : (
          sources.map((source) => (
            <div key={source.categoryId} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-3">
                <CategoryAvatar
                  color={source.color as CategoryColor}
                  icon={source.icon as CategoryIcon}
                  size={14}
                  className="size-7"
                />
                <p className="text-sm font-medium text-foreground">{source.name}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium tabular-nums text-pos">{formatCurrency(source.amount, currency)}</p>
                <p className="text-xs text-muted-foreground">
                  {source.quotaPct === null ? "—" : `${Math.round(source.quotaPct)}% del totale`}
                </p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: "Dove va ogni euro" block**

Create `components/domain/cashflow/where-it-goes-breakdown.tsx`:

```typescript
/** "Dove va ogni euro" block (current month): fixed expenses, variable expenses, savings — amount and % share of the month's total income. */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
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
            <p className="text-sm font-medium text-foreground">{entry.label}</p>
            <div className="text-right">
              <p
                className={cn(
                  "text-sm font-medium tabular-nums",
                  entry.key === "risparmio" && entry.amount < 0 ? "text-neg" : "text-foreground"
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

- [ ] **Step 4: Accumulated savings chart**

Create `components/domain/cashflow/accumulated-savings-chart.tsx`:

```typescript
"use client";

/** "Risparmio accumulato" chart: line of the cumulative sum of the net flow over the selected period, with the final total. */

import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/format";
import type { AccumulatedSavingsEntry } from "@/lib/calc/cashflow";

const CHART_CONFIG = {
  cumulative: { label: "Risparmio accumulato", color: "var(--pos)" },
} satisfies ChartConfig;

export interface AccumulatedSavingsChartProps {
  entries: AccumulatedSavingsEntry[];
  currency: string;
}

export function AccumulatedSavingsChart({ entries, currency }: AccumulatedSavingsChartProps) {
  const total = entries.length > 0 ? entries[entries.length - 1].cumulative : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Risparmio accumulato
        </CardTitle>
        <span className="font-heading text-lg font-medium tabular-nums text-foreground">
          {formatCurrency(total, currency)}
        </span>
      </CardHeader>
      <CardContent>
        <ChartContainer config={CHART_CONFIG} className="max-h-64 w-full">
          <LineChart data={entries}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => formatCurrency(Number(value), currency, { maximumFractionDigits: 0 })}
            />
            <ReferenceLine y={0} stroke="var(--border)" />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => (
                    <div className="flex w-full items-center justify-between gap-3">
                      <span className="text-muted-foreground">Accumulato</span>
                      <span className="font-mono font-medium tabular-nums text-foreground">
                        {formatCurrency(Number(value), currency)}
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Line type="monotone" dataKey="cumulative" stroke="var(--color-cumulative)" strokeWidth={2} dot={false} />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Update the barrel**

Replace `components/domain/cashflow/index.ts` entirely:

```typescript
/**
 * components/domain/cashflow — barrel file
 *
 * Single entry point for the components of the Cash flow screen.
 */

export { CashflowPeriodSelector } from "./cashflow-period-selector";
export type { CashflowPeriodSelectorProps } from "./cashflow-period-selector";
export { CashflowReferenceNav } from "./cashflow-reference-nav";
export type { CashflowReferenceNavProps } from "./cashflow-reference-nav";
export { CashflowKpiCards } from "./cashflow-kpi-cards";
export type { CashflowKpiCardsProps } from "./cashflow-kpi-cards";
export { CashflowTrendChart } from "./cashflow-trend-chart";
export type { CashflowTrendChartProps } from "./cashflow-trend-chart";
export { IncomeSourcesList } from "./income-sources-list";
export type { IncomeSourcesListProps } from "./income-sources-list";
export { WhereItGoesBreakdown } from "./where-it-goes-breakdown";
export type { WhereItGoesBreakdownProps } from "./where-it-goes-breakdown";
export { AccumulatedSavingsChart } from "./accumulated-savings-chart";
export type { AccumulatedSavingsChartProps } from "./accumulated-savings-chart";
```

- [ ] **Step 6: Type check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add components/domain/cashflow/cashflow-trend-chart.tsx components/domain/cashflow/income-sources-list.tsx components/domain/cashflow/where-it-goes-breakdown.tsx components/domain/cashflow/accumulated-savings-chart.tsx components/domain/cashflow/index.ts
git commit -m "feat: grafici e liste Cash flow (entrate/uscite, fonti, dove va ogni euro, risparmio accumulato)"
```

---

### Task 11: Cash flow page

**Files:**
- Create: `app/(app)/cash-flow/page.tsx`

**Interfaces:**
- Consumes: all the components of the `components/domain/cashflow` barrel (Tasks 9-10); `useTransactionsQuery(from, to, "tutte")` (Task 4); `useCategoriesQuery`; `computeMonthlySeries`, `computeIncomeSources`, `computeWhereItGoes`, `computeAccumulatedSavings`, `getCashflowPeriodRange` (Task 8).

- [ ] **Step 1: Implement the page**

Create `app/(app)/cash-flow/page.tsx`:

```typescript
"use client";

/** Cash flow page: read-only dashboard — income/outflow comparison, income sources, where every euro goes, accumulated savings. */

import * as React from "react";
import {
  AccumulatedSavingsChart,
  CashflowKpiCards,
  CashflowPeriodSelector,
  CashflowReferenceNav,
  CashflowTrendChart,
  IncomeSourcesList,
  WhereItGoesBreakdown,
} from "@/components/domain/cashflow";
import { authClient } from "@/lib/auth/client";
import {
  computeAccumulatedSavings,
  computeIncomeSources,
  computeMonthlySeries,
  computeWhereItGoes,
  getCashflowPeriodRange,
  type CashflowPeriod,
} from "@/lib/calc/cashflow";
import { useCategoriesQuery } from "@/lib/queries/categories";
import { useTransactionsQuery } from "@/lib/queries/transactions";

function toDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Fetch window: 24 months before the reference date up to today — covers the maximum selectable period (24M) plus the comparison with the previous period. */
function fetchWindow(referenceDate: Date): { from: string; to: string } {
  const from = new Date(referenceDate.getFullYear() - 4, referenceDate.getMonth(), 1);
  const to = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);
  return { from: toDateString(from), to: toDateString(to) };
}

export default function CashFlowPage() {
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const [referenceDate, setReferenceDate] = React.useState<Date>(() => new Date());
  const [period, setPeriod] = React.useState<CashflowPeriod>("6mesi");

  const { from, to } = fetchWindow(referenceDate);
  const { data: transactions, isLoading, isError, refetch } = useTransactionsQuery(from, to, "tutte");
  const { data: categories } = useCategoriesQuery();

  const safeTransactions = transactions ?? [];
  const safeCategories = categories ?? [];

  const range = getCashflowPeriodRange(period, referenceDate);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-medium text-foreground">Cash flow</h1>
          <CashflowReferenceNav period={period} referenceDate={referenceDate} onChange={setReferenceDate} />
        </div>
        <CashflowPeriodSelector value={period} onChange={setPeriod} />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Impossibile caricare i dati.{" "}
          <button onClick={() => refetch()} className="underline underline-offset-2">
            Riprova
          </button>
        </div>
      ) : (
        <>
          <CashflowKpiCards
            transactions={safeTransactions}
            period={period}
            currency={currency}
            referenceDate={referenceDate}
          />

          <CashflowTrendChart monthlySeries={computeMonthlySeries(safeTransactions, range)} currency={currency} />

          <IncomeSourcesList
            sources={computeIncomeSources(safeTransactions, safeCategories, range)}
            currency={currency}
          />

          <WhereItGoesBreakdown
            entries={computeWhereItGoes(safeTransactions, safeCategories, referenceDate)}
            currency={currency}
          />

          <AccumulatedSavingsChart
            entries={computeAccumulatedSavings(safeTransactions, range)}
            currency={currency}
          />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run the whole suite to make sure nothing broke**

Run: `pnpm test`
Expected: PASS on all files (including those not touched by this plan).

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/cash-flow/page.tsx"
git commit -m "feat: pagina Cash flow (KPI, entrate/uscite, fonti, dove va ogni euro, risparmio accumulato)"
```

---

## Manual verification (cannot be automated in this sandbox)

No Postgres/Redis available for a real browser in the agentic sessions of this project (same constraint as all the previous features). To be verified manually by the user after the merge:
- Create an Entrata-type category from `/categorie`, check its icon/color.
- Record an income entry from the Transazioni form (Spesa/Entrata toggle), verify that it appears with a positive amount and does not affect the KPI/donut/trend of Transazioni.
- Tutte/Uscite/Entrate toggle on the Transazioni list.
- Edit the amount of an existing income entry (it must stay positive) and try to change its category to an incompatible one (it must fail, except towards "Da categorizzare").
- Cash flow page: 4 KPIs, income/outflow chart, income sources, where every euro goes (current month), accumulated savings — on all 4 periods (3M/6M/12M/24M) and navigating forward/backward.
