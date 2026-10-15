# Base data model (Accounts, Categories, Transactions, Budgets) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drizzle/Postgres schema for `users` (stub), `categories`, `accounts`, `transactions`, `budgets`, with versioned migrations applied to a real Postgres (Neon, development only) and an end-to-end integration test that verifies the full round trip.

**Architecture:** A `lib/db/` module with one Drizzle schema per entity (barrel `lib/db/schema/index.ts`), a shared Postgres client (`lib/db/client.ts`), migrations generated with `drizzle-kit` and applied with a dedicated script (not `drizzle-kit push`, to stay consistent with the migration-file workflow already planned in the infra plan). No UI, no API, no authentication: only the data layer.

**Tech Stack:** Drizzle ORM, `postgres` driver (postgres.js), Postgres on Neon (development only), Vitest for tests, `tsx` to run standalone TypeScript scripts (seed, migrate).

## Global Constraints

- Package manager: **pnpm**.
- **The agent NEVER runs git commands in this repo** (project rule in `CLAUDE.md`). Every step that would normally involve `git add`/`commit` must be presented to the user as the exact command to run themselves, asking for confirmation before moving on to the next task.
- Schema compliant with `docs/superpowers/specs/2026-07-03-data-model-base-design.md`: all tables reference `users.id` with `onDelete: "cascade"`; `excluded_amount` validated **only at the application level** (pure function `isValidExcludedAmount`), **no DB CHECK constraint** in this phase (explicitly decided in the spec).
- **Versioned** migrations (`drizzle-kit generate` + dedicated migrate script), not `drizzle-kit push` — to stay consistent with the Kubernetes Job already planned in `docs/superpowers/plans/2026-07-03-infra-foundation.md` (currently paused) when production arrives.
- Barrel file mandatory for the schema (`lib/db/schema/index.ts`), per project convention.
- The 8 seed categories: **fixed** (fisse) → Affitto, Bollette & casa, Abbonamenti; **variable** (variabili) → Spesa alimentare, Ristoranti, Altro, Svago, Trasporti.

---

## File Structure

- `.env.local.example` (new) — connection string template, committed.
- `.env.local` (new, **not committed**) — real Neon connection string, created by the user in Task 1.
- `.gitignore` (modify) — adds an exception to commit `.env.local.example` despite the `.env*` pattern.
- `drizzle.config.ts` (new, root) — `drizzle-kit` configuration.
- `vitest.config.ts` (new, root) — test runner configuration.
- `vitest.setup.ts` (new, root) — loads `.env.local` before the tests.
- `package.json` (modify) — new dependencies and `db:generate`/`db:migrate`/`db:seed`/`test` scripts.
- `lib/db/client.ts` (new) — shared Drizzle/postgres.js client.
- `lib/db/migrate.ts` (new) — script that applies the generated migrations.
- `lib/db/seed.ts` (new) — creates a development user and its 8 categories.
- `lib/db/schema/shared.ts` (new) — `dataSourceEnum` enum shared between `accounts` and `transactions`.
- `lib/db/schema/users.ts` (new)
- `lib/db/schema/categories.ts` (new) — includes `DEFAULT_CATEGORIES`.
- `lib/db/schema/accounts.ts` (new)
- `lib/db/schema/transactions.ts` (new) — includes `isValidExcludedAmount`.
- `lib/db/schema/budgets.ts` (new)
- `lib/db/schema/index.ts` (new) — barrel.
- `lib/db/schema/transactions.test.ts` (new) — pure unit test (no DB) for `isValidExcludedAmount`.
- `lib/db/integration.test.ts` (new) — full round trip against Neon.

---

### Task 1 (Manual — requires an external account): Neon provisioning + `.env.local`

This task requires creating an account on an external service; an agent cannot run it without your credentials.

**Interfaces:**
- Produces: a valid `DATABASE_URL` in `.env.local`, which all later tasks (from Task 8 on) will use to connect to a real Postgres.

- [ ] **Step 1: Create a free Neon project**

On https://neon.tech (or via `neonctl` if you prefer the CLI): create an account, then a new project (free tier plan). Neon automatically creates a database and shows you a connection string in the format:

```
postgresql://<user>:<password>@<host>/<database>?sslmode=require
```

- [ ] **Step 2: Create `.env.local` in the repo root**

```
DATABASE_URL="postgresql://<user>:<password>@<host>/<database>?sslmode=require"
```

Replace the value with the real connection string copied from Neon. This file must never be committed (it is already covered by `.env*` in `.gitignore`).

---

### Task 2: Dependencies, Drizzle/Vitest config, package.json scripts

**Files:**
- Create: `.env.local.example`
- Modify: `.gitignore`
- Create: `drizzle.config.ts`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `DATABASE_URL` in `.env.local` (Task 1).
- Produces: `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm test` commands available to later tasks; `vitest.setup.ts` loads `.env.local` before every test run, which `lib/db/integration.test.ts` (Task 10) relies on.

- [ ] **Step 1: Install the dependencies**

Run: `pnpm add drizzle-orm postgres`
Run: `pnpm add -D drizzle-kit vitest tsx dotenv`

Expected: both commands finish without errors and `package.json` shows the new dependencies in `dependencies`/`devDependencies`.

- [ ] **Step 2: Create `.env.local.example`**

```
DATABASE_URL="postgresql://<user>:<password>@<host>/<database>?sslmode=require"
```

- [ ] **Step 3: Allow committing `.env.local.example` despite `.env*`**

In the `.gitignore` file, right after the block:

```
# env files (can opt-in for committing if needed)
.env*
```

add:

```
!.env.local.example
```

- [ ] **Step 4: Create `drizzle.config.ts`**

```ts
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL non è definita. Copia .env.local.example in .env.local.");
}

export default defineConfig({
  schema: "./lib/db/schema/index.ts",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
```

- [ ] **Step 5: Create `vitest.setup.ts`**

```ts
import { config } from "dotenv";

config({ path: ".env.local" });
```

- [ ] **Step 6: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./vitest.setup.ts"],
  },
});
```

- [ ] **Step 7: Add the scripts to `package.json`**

In the existing `"scripts"` block, add:

```json
"test": "vitest run",
"db:generate": "drizzle-kit generate",
"db:migrate": "tsx lib/db/migrate.ts",
"db:seed": "tsx lib/db/seed.ts"
```

- [ ] **Step 8: Verify that the project type-check is still clean**

Run: `pnpm exec tsc --noEmit`
Expected: no errors (the files created so far are only config, no application code yet).

- [ ] **Step 9: Commit (manual — the agent does not run git in this repo)**

```bash
git add .env.local.example .gitignore drizzle.config.ts vitest.config.ts vitest.setup.ts package.json pnpm-lock.yaml
git commit -m "build: bootstrap Drizzle ORM and Vitest for the data layer"
```

---

### Task 3: Schema `users`

**Files:**
- Create: `lib/db/schema/users.ts`

**Interfaces:**
- Produces: `users` (Drizzle table), `User`/`NewUser` types — used by `categories`, `accounts`, `transactions`, `budgets` (Tasks 4-7) as the target of the `user_id` FK.

- [ ] **Step 1: Create `lib/db/schema/users.ts`**

```ts
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  currency: text("currency").notNull().default("EUR"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

- [ ] **Step 2: Verify that the file compiles**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit (manual — the agent does not run git in this repo)**

```bash
git add lib/db/schema/users.ts
git commit -m "feat: add users table schema (auth stub)"
```

---

### Task 4: Schema `categories`

**Files:**
- Create: `lib/db/schema/categories.ts`

**Interfaces:**
- Consumes: `users` from `lib/db/schema/users.ts` (Task 3).
- Produces: `categories` (table), `DEFAULT_CATEGORIES` (seed array) — used by `lib/db/seed.ts` (Task 9) and by `transactions`/`budgets` (Tasks 6-7) as the target of the `category_id` FK.

- [ ] **Step 1: Create `lib/db/schema/categories.ts`**

```ts
import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const categoryTypeEnum = pgEnum("category_type", ["fissa", "variabile"]);

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: categoryTypeEnum("type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export const DEFAULT_CATEGORIES: { name: string; type: "fissa" | "variabile" }[] = [
  { name: "Affitto", type: "fissa" },
  { name: "Bollette & casa", type: "fissa" },
  { name: "Abbonamenti", type: "fissa" },
  { name: "Spesa alimentare", type: "variabile" },
  { name: "Ristoranti", type: "variabile" },
  { name: "Altro", type: "variabile" },
  { name: "Svago", type: "variabile" },
  { name: "Trasporti", type: "variabile" },
];
```

- [ ] **Step 2: Verify that the file compiles**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit (manual — the agent does not run git in this repo)**

```bash
git add lib/db/schema/categories.ts
git commit -m "feat: add categories table schema with default seed list"
```

---

### Task 5: Shared enum + `accounts` schema

**Files:**
- Create: `lib/db/schema/shared.ts`
- Create: `lib/db/schema/accounts.ts`

**Interfaces:**
- Consumes: `users` (Task 3).
- Produces: `dataSourceEnum` (also used by `transactions`, Task 6), `accounts` (table), `Account`/`NewAccount` types — used by `transactions` (Task 6) as the target of the `account_id` FK.

- [ ] **Step 1: Create `lib/db/schema/shared.ts`**

```ts
import { pgEnum } from "drizzle-orm/pg-core";

export const dataSourceEnum = pgEnum("data_source", ["manuale", "auto"]);
```

- [ ] **Step 2: Create `lib/db/schema/accounts.ts`**

```ts
import { numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { dataSourceEnum } from "./shared";
import { users } from "./users";

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  institution: text("institution"),
  type: text("type").notNull(),
  balance: numeric("balance", { precision: 12, scale: 2 }).notNull().default("0"),
  source: dataSourceEnum("source").notNull().default("manuale"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
```

- [ ] **Step 3: Verify that the file compiles**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit (manual — the agent does not run git in this repo)**

```bash
git add lib/db/schema/shared.ts lib/db/schema/accounts.ts
git commit -m "feat: add accounts table schema"
```

---

### Task 6: `transactions` schema + `excluded_amount` validation (TDD)

**Files:**
- Create: `lib/db/schema/transactions.ts`
- Test: `lib/db/schema/transactions.test.ts`

**Interfaces:**
- Consumes: `users` (Task 3), `accounts`+`dataSourceEnum` (Task 5), `categories` (Task 4).
- Produces: `transactions` (table), `Transaction`/`NewTransaction` types, `isValidExcludedAmount(amount: number, excludedAmount: number): boolean` — the latter is the function that the (future) Spese ("Expenses") screen plan/spec will use to validate the "Dividi" ("Split") mechanism before writing to the DB.

- [ ] **Step 1: Write the test (it will fail: the module does not exist yet)**

Create `lib/db/schema/transactions.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isValidExcludedAmount } from "./transactions";

describe("isValidExcludedAmount", () => {
  it("accetta una quota esclusa con lo stesso segno e valore assoluto minore o uguale", () => {
    expect(isValidExcludedAmount(-50, -10)).toBe(true);
    expect(isValidExcludedAmount(-50, -50)).toBe(true);
    expect(isValidExcludedAmount(100, 40)).toBe(true);
  });

  it("rifiuta una quota esclusa più grande in valore assoluto dell'importo", () => {
    expect(isValidExcludedAmount(-50, -60)).toBe(false);
  });

  it("rifiuta una quota esclusa di segno opposto all'importo", () => {
    expect(isValidExcludedAmount(-50, 10)).toBe(false);
  });

  it("accetta 0 come quota esclusa indipendentemente dal segno dell'importo", () => {
    expect(isValidExcludedAmount(-50, 0)).toBe(true);
    expect(isValidExcludedAmount(50, 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test and verify that it fails**

Run: `pnpm test transactions.test.ts`
Expected: FAIL — module resolution error (`lib/db/schema/transactions.ts` does not exist).

- [ ] **Step 3: Create `lib/db/schema/transactions.ts`**

```ts
import { date, index, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { accounts } from "./accounts";
import { categories } from "./categories";
import { dataSourceEnum } from "./shared";
import { users } from "./users";

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    description: text("description").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    excludedAmount: numeric("excluded_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    date: date("date").notNull(),
    source: dataSourceEnum("source").notNull().default("manuale"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("transactions_user_date_idx").on(table.userId, table.date)]
);

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

/**
 * Checks the invariant of the "Dividi" (split) mechanism: the excluded share must have
 * the same sign as the amount (or be zero) and an absolute value no greater than it.
 * Application-level validation only, no DB CHECK constraint (per spec decision).
 */
export function isValidExcludedAmount(amount: number, excludedAmount: number): boolean {
  if (excludedAmount !== 0 && Math.sign(excludedAmount) !== Math.sign(amount)) {
    return false;
  }
  return Math.abs(excludedAmount) <= Math.abs(amount);
}
```

- [ ] **Step 4: Run the test and verify that it passes**

Run: `pnpm test transactions.test.ts`
Expected: PASS, 4 tests passed.

- [ ] **Step 5: Verify that the whole project compiles**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit (manual — the agent does not run git in this repo)**

```bash
git add lib/db/schema/transactions.ts lib/db/schema/transactions.test.ts
git commit -m "feat: add transactions table schema with excluded-amount validation"
```

---

### Task 7: `budgets` schema, barrel, Drizzle client

**Files:**
- Create: `lib/db/schema/budgets.ts`
- Create: `lib/db/schema/index.ts`
- Create: `lib/db/client.ts`

**Interfaces:**
- Consumes: `users` (Task 3), `categories` (Task 4), all previous tables (for the barrel).
- Produces: `budgets` (table), `Budget`/`NewBudget` types; `lib/db/schema/index.ts` as the single import point for the schema (used by `drizzle.config.ts`, Task 2, and by all later tasks); `db` (Drizzle instance) and `client` (raw postgres.js connection) from `lib/db/client.ts` — used by `lib/db/migrate.ts` (Task 8), `lib/db/seed.ts` (Task 9), `lib/db/integration.test.ts` (Task 10).

- [ ] **Step 1: Create `lib/db/schema/budgets.ts`**

```ts
import { numeric, pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { categories } from "./categories";
import { users } from "./users";

export const budgets = pgTable(
  "budgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    monthlyAmount: numeric("monthly_amount", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("budgets_user_category_unique").on(table.userId, table.categoryId)]
);

export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
```

- [ ] **Step 2: Create the barrel `lib/db/schema/index.ts`**

```ts
export * from "./shared";
export * from "./users";
export * from "./categories";
export * from "./accounts";
export * from "./transactions";
export * from "./budgets";
```

- [ ] **Step 3: Create `lib/db/client.ts`**

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL non è definita. Copia .env.local.example in .env.local.");
}

export const client = postgres(connectionString, { ssl: "require" });
export const db = drizzle(client, { schema });
```

- [ ] **Step 4: Verify that the project compiles**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit (manual — the agent does not run git in this repo)**

```bash
git add lib/db/schema/budgets.ts lib/db/schema/index.ts lib/db/client.ts
git commit -m "feat: add budgets table schema, schema barrel, and Drizzle client"
```

---

### Task 8: Generate and apply the migration on Neon

**Files:**
- Create: `lib/db/migrations/` (generated by `drizzle-kit generate`, exact content not predictable in advance)
- Create: `lib/db/migrate.ts`

**Interfaces:**
- Consumes: `lib/db/schema/index.ts` (Task 7), `DATABASE_URL` (Task 1).
- Produces: the 5 tables actually created on the development Neon Postgres — precondition for `lib/db/seed.ts` (Task 9) and `lib/db/integration.test.ts` (Task 10).

- [ ] **Step 1: Generate the migration files from the schema**

Run: `pnpm db:generate`
Expected: output confirming the creation of a SQL file under `lib/db/migrations/` (e.g. `0000_<nome_casuale>.sql`), with 5 `CREATE TABLE` statements (`users`, `categories`, `accounts`, `transactions`, `budgets`) plus the enum types.

- [ ] **Step 2: Create `lib/db/migrate.ts`**

```ts
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { client, db } from "./client";

async function main() {
  await migrate(db, { migrationsFolder: "./lib/db/migrations" });

  const tables = await client.unsafe(
    "select table_name from information_schema.tables where table_schema = 'public' order by table_name"
  );
  console.log(
    "Tabelle presenti:",
    tables.map((row) => row.table_name)
  );

  await client.end();
}

main()
  .then(() => {
    console.log("Migration completate.");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

- [ ] **Step 3: Apply the migration to Neon and verify that the tables really exist**

Run: `pnpm db:migrate`
Expected: prints `Tabelle presenti: [ 'accounts', 'budgets', 'categories', 'transactions', 'users' ]` followed by `Migration completate.`, with no errors.

- [ ] **Step 4: Commit (manual — the agent does not run git in this repo)**

```bash
git add lib/db/migrations lib/db/migrate.ts
git commit -m "feat: generate and apply initial database migration"
```

---

### Task 9: Seed script (dev user + categories)

**Files:**
- Create: `lib/db/seed.ts`

**Interfaces:**
- Consumes: `db`, `client` (Task 7), `users`, `categories`, `DEFAULT_CATEGORIES` (Tasks 3-4), real tables on Neon (Task 8).
- Produces: one `users` row and 8 real `categories` rows on Neon — a useful (not mandatory) precondition for `lib/db/integration.test.ts` (Task 10), which creates its own independent test user anyway.

- [ ] **Step 1: Create `lib/db/seed.ts`**

```ts
import { client, db } from "./client";
import { categories, DEFAULT_CATEGORIES } from "./schema/categories";
import { users } from "./schema/users";

async function seed() {
  const [user] = await db.insert(users).values({}).returning();

  const insertedCategories = await db
    .insert(categories)
    .values(
      DEFAULT_CATEGORIES.map((category) => ({
        userId: user.id,
        name: category.name,
        type: category.type,
      }))
    )
    .returning();

  console.log(`Utente dev creato: ${user.id}`);
  console.log(`Categorie create: ${insertedCategories.length}`);
  await client.end();
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 2: Run the seed and check the result**

Run: `pnpm db:seed`
Expected: output `Utente dev creato: <uuid>` followed by `Categorie create: 8`, with no errors.

- [ ] **Step 3: Commit (manual — the agent does not run git in this repo)**

```bash
git add lib/db/seed.ts
git commit -m "feat: add dev seed script for a user and default categories"
```

---

### Task 10: End-to-end integration test

**Files:**
- Test: `lib/db/integration.test.ts`

**Interfaces:**
- Consumes: `db`, `users`, `categories`, `accounts`, `transactions`, `budgets`, `isValidExcludedAmount` (all previous tasks).
- Produces: no new interface — it is the final check that the whole schema works together against a real Postgres.

- [ ] **Step 1: Write the test**

This test does not follow the "red then green" pattern: the schema and client were already implemented in Tasks 3-7, so there is no missing production code to write afterwards. Its purpose is to verify that all the pieces work together against a real Postgres (including the `onDelete: cascade` behavior), not to drive a new implementation.

Create `lib/db/integration.test.ts`:

```ts
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { client, db } from "./client";
import { accounts } from "./schema/accounts";
import { budgets } from "./schema/budgets";
import { categories } from "./schema/categories";
import { isValidExcludedAmount, transactions } from "./schema/transactions";
import { users } from "./schema/users";

describe("modello dati base — round trip end-to-end", () => {
  let userId: string;

  afterAll(async () => {
    if (userId) {
      await db.delete(users).where(eq(users.id, userId));
    }
    await client.end();
  });

  it("crea utente, categoria, conto, transazione con Dividi e budget, e li rilegge correttamente", async () => {
    const [user] = await db.insert(users).values({ currency: "EUR" }).returning();
    userId = user.id;
    expect(user.currency).toBe("EUR");

    const [category] = await db
      .insert(categories)
      .values({ userId, name: "Spesa alimentare", type: "variabile" })
      .returning();

    const [account] = await db
      .insert(accounts)
      .values({ userId, name: "Conto corrente", type: "corrente", balance: "1000.00" })
      .returning();
    expect(account.source).toBe("manuale");

    const [transaction] = await db
      .insert(transactions)
      .values({
        userId,
        accountId: account.id,
        categoryId: category.id,
        description: "Spesa al supermercato",
        amount: "-50.00",
        excludedAmount: "-10.00",
        date: "2026-07-01",
      })
      .returning();

    expect(transaction.amount).toBe("-50.00");
    expect(transaction.excludedAmount).toBe("-10.00");
    expect(isValidExcludedAmount(Number(transaction.amount), Number(transaction.excludedAmount))).toBe(true);

    const [budget] = await db
      .insert(budgets)
      .values({ userId, categoryId: category.id, monthlyAmount: "300.00" })
      .returning();
    expect(budget.monthlyAmount).toBe("300.00");

    const storedTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId));
    expect(storedTransactions).toHaveLength(1);
  });

  it("cancellando l'utente cancella a cascata categorie, conti, transazioni e budget", async () => {
    const [user] = await db.insert(users).values({ currency: "EUR" }).returning();

    const [category] = await db
      .insert(categories)
      .values({ userId: user.id, name: "Trasporti", type: "variabile" })
      .returning();
    const [account] = await db
      .insert(accounts)
      .values({ userId: user.id, name: "Contanti", type: "contanti", balance: "50.00" })
      .returning();
    await db.insert(transactions).values({
      userId: user.id,
      accountId: account.id,
      categoryId: category.id,
      description: "Biglietto bus",
      amount: "-2.50",
      date: "2026-07-02",
    });
    await db.insert(budgets).values({ userId: user.id, categoryId: category.id, monthlyAmount: "50.00" });

    await db.delete(users).where(eq(users.id, user.id));

    const remainingCategories = await db.select().from(categories).where(eq(categories.userId, user.id));
    const remainingAccounts = await db.select().from(accounts).where(eq(accounts.userId, user.id));
    const remainingTransactions = await db.select().from(transactions).where(eq(transactions.userId, user.id));
    const remainingBudgets = await db.select().from(budgets).where(eq(budgets.userId, user.id));

    expect(remainingCategories).toHaveLength(0);
    expect(remainingAccounts).toHaveLength(0);
    expect(remainingTransactions).toHaveLength(0);
    expect(remainingBudgets).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test and verify that it passes**

Run: `pnpm test integration.test.ts`
Expected: PASS, 2 tests passed, no connection errors to Neon.

- [ ] **Step 3: Run the project's whole test suite**

Run: `pnpm test`
Expected: PASS, all tests (unit `transactions.test.ts` + integration `integration.test.ts`) passed.

- [ ] **Step 4: Commit (manual — the agent does not run git in this repo)**

```bash
git add lib/db/integration.test.ts
git commit -m "test: add end-to-end integration test for the base data model"
```

---

## Out of scope for this plan (consciously deferred, see also the spec)

- **UI, API, real authentication**: this plan only produces the data schema.
- **Per-month budget history, customizable categories, per-row multi-currency**: out of scope as per the spec.
- **DB CHECK constraint for `excluded_amount`**: only application-level validation (`isValidExcludedAmount`) for now.
- **Wiring the validation into real inserts/updates**: `isValidExcludedAmount` is exported and tested, but not yet used by a service/API layer (which does not exist yet) — that will be the responsibility of the Spese ("Expenses") screen spec.
- **Production deploy**: the infra plan (`docs/superpowers/plans/2026-07-03-infra-foundation.md`) remains paused; Neon is used here for development only.
