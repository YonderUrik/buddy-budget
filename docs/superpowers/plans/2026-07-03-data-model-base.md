# Modello dati base (Conti, Categorie, Transazioni, Budget) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Schema Drizzle/Postgres per `users` (stub), `categories`, `accounts`, `transactions`, `budgets`, con migration versionate applicate a un Postgres reale (Neon, solo sviluppo) e un test di integrazione end-to-end che verifica il round trip completo.

**Architecture:** Un modulo `lib/db/` con uno schema Drizzle per entità (barrel `lib/db/schema/index.ts`), un client Postgres condiviso (`lib/db/client.ts`), migration generate con `drizzle-kit` e applicate con uno script dedicato (non `drizzle-kit push`, per restare coerenti col workflow a migration-file già previsto nel piano infra). Nessuna UI, nessuna API, nessuna autenticazione: solo il livello dati.

**Tech Stack:** Drizzle ORM, driver `postgres` (postgres.js), Postgres su Neon (solo sviluppo), Vitest per i test, `tsx` per eseguire script TypeScript standalone (seed, migrate).

## Global Constraints

- Package manager: **pnpm**.
- **L'agente non esegue MAI comandi git in questo repo** (regola di progetto in `CLAUDE.md`). Ogni step che normalmente prevede `git add`/`commit` va presentato all'utente come comando esatto da eseguire lui stesso, con richiesta di conferma prima di procedere al task successivo.
- Schema conforme a `docs/superpowers/specs/2026-07-03-data-model-base-design.md`: tutte le tabelle referenziano `users.id` con `onDelete: "cascade"`; `excluded_amount` validato **solo a livello applicativo** (funzione pura `isValidExcludedAmount`), **nessun CHECK constraint DB** in questa fase (deciso esplicitamente nello spec).
- Migration **versionate** (`drizzle-kit generate` + script di migrate dedicato), non `drizzle-kit push` — per restare coerenti con il Job Kubernetes già previsto in `docs/superpowers/plans/2026-07-03-infra-foundation.md` (oggi in pausa) quando la produzione arriverà.
- Barrel file obbligatorio per lo schema (`lib/db/schema/index.ts`), come da convenzione di progetto.
- Le 8 categorie seed: **fisse** → Affitto, Bollette & casa, Abbonamenti; **variabili** → Spesa alimentare, Ristoranti, Altro, Svago, Trasporti.

---

## File Structure

- `.env.local.example` (nuovo) — template della connection string, committato.
- `.env.local` (nuovo, **non committato**) — connection string reale di Neon, creato dall'utente nel Task 1.
- `.gitignore` (modifica) — aggiunge un'eccezione per committare `.env.local.example` nonostante il pattern `.env*`.
- `drizzle.config.ts` (nuovo, root) — configurazione `drizzle-kit`.
- `vitest.config.ts` (nuovo, root) — configurazione test runner.
- `vitest.setup.ts` (nuovo, root) — carica `.env.local` prima dei test.
- `package.json` (modifica) — nuove dipendenze e script `db:generate`/`db:migrate`/`db:seed`/`test`.
- `lib/db/client.ts` (nuovo) — client Drizzle/postgres.js condiviso.
- `lib/db/migrate.ts` (nuovo) — script che applica le migration generate.
- `lib/db/seed.ts` (nuovo) — crea un utente di sviluppo e le sue 8 categorie.
- `lib/db/schema/shared.ts` (nuovo) — enum `dataSourceEnum` condiviso tra `accounts` e `transactions`.
- `lib/db/schema/users.ts` (nuovo)
- `lib/db/schema/categories.ts` (nuovo) — include `DEFAULT_CATEGORIES`.
- `lib/db/schema/accounts.ts` (nuovo)
- `lib/db/schema/transactions.ts` (nuovo) — include `isValidExcludedAmount`.
- `lib/db/schema/budgets.ts` (nuovo)
- `lib/db/schema/index.ts` (nuovo) — barrel.
- `lib/db/schema/transactions.test.ts` (nuovo) — unit test puro (nessun DB) per `isValidExcludedAmount`.
- `lib/db/integration.test.ts` (nuovo) — round trip completo contro Neon.

---

### Task 1 (Manuale — richiede un account esterno): Provisioning Neon + `.env.local`

Questo task richiede di creare un account su un servizio esterno; non è eseguibile da un agente senza le tue credenziali.

**Interfaces:**
- Produces: una `DATABASE_URL` valida in `.env.local`, che tutti i task successivi (a partire dal Task 8) useranno per connettersi a un Postgres reale.

- [ ] **Step 1: Creare un progetto Neon gratuito**

Su https://neon.tech (o via `neonctl` se preferisci la CLI): crea un account, poi un nuovo progetto (piano free tier). Neon crea automaticamente un database e ti mostra una connection string nel formato:

```
postgresql://<user>:<password>@<host>/<database>?sslmode=require
```

- [ ] **Step 2: Creare `.env.local` nella root del repo**

```
DATABASE_URL="postgresql://<user>:<password>@<host>/<database>?sslmode=require"
```

Sostituisci il valore con la connection string reale copiata da Neon. Questo file non va mai committato (è già coperto da `.env*` in `.gitignore`).

---

### Task 2: Dipendenze, config Drizzle/Vitest, script package.json

**Files:**
- Create: `.env.local.example`
- Modify: `.gitignore`
- Create: `drizzle.config.ts`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `DATABASE_URL` in `.env.local` (Task 1).
- Produces: comandi `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm test` disponibili per i task successivi; `vitest.setup.ts` carica `.env.local` prima di ogni test run, assunto da `lib/db/integration.test.ts` (Task 10).

- [ ] **Step 1: Installare le dipendenze**

Run: `pnpm add drizzle-orm postgres`
Run: `pnpm add -D drizzle-kit vitest tsx dotenv`

Expected: entrambi i comandi terminano senza errori e `package.json` mostra le nuove dipendenze in `dependencies`/`devDependencies`.

- [ ] **Step 2: Creare `.env.local.example`**

```
DATABASE_URL="postgresql://<user>:<password>@<host>/<database>?sslmode=require"
```

- [ ] **Step 3: Permettere il commit di `.env.local.example` nonostante `.env*`**

Nel file `.gitignore`, subito dopo il blocco:

```
# env files (can opt-in for committing if needed)
.env*
```

aggiungi:

```
!.env.local.example
```

- [ ] **Step 4: Creare `drizzle.config.ts`**

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

- [ ] **Step 5: Creare `vitest.setup.ts`**

```ts
import { config } from "dotenv";

config({ path: ".env.local" });
```

- [ ] **Step 6: Creare `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./vitest.setup.ts"],
  },
});
```

- [ ] **Step 7: Aggiungere gli script a `package.json`**

Nel blocco `"scripts"` esistente, aggiungi:

```json
"test": "vitest run",
"db:generate": "drizzle-kit generate",
"db:migrate": "tsx lib/db/migrate.ts",
"db:seed": "tsx lib/db/seed.ts"
```

- [ ] **Step 8: Verificare che il type-check del progetto sia ancora pulito**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore (i file creati finora sono solo config, nessun codice applicativo ancora).

- [ ] **Step 9: Commit (manuale — l'agente non esegue git in questo repo)**

```bash
git add .env.local.example .gitignore drizzle.config.ts vitest.config.ts vitest.setup.ts package.json pnpm-lock.yaml
git commit -m "build: bootstrap Drizzle ORM and Vitest for the data layer"
```

---

### Task 3: Schema `users`

**Files:**
- Create: `lib/db/schema/users.ts`

**Interfaces:**
- Produces: `users` (tabella Drizzle), tipi `User`/`NewUser` — usati da `categories`, `accounts`, `transactions`, `budgets` (Task 4-7) come target della FK `user_id`.

- [ ] **Step 1: Creare `lib/db/schema/users.ts`**

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

- [ ] **Step 2: Verificare che il file compili**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Commit (manuale — l'agente non esegue git in questo repo)**

```bash
git add lib/db/schema/users.ts
git commit -m "feat: add users table schema (auth stub)"
```

---

### Task 4: Schema `categories`

**Files:**
- Create: `lib/db/schema/categories.ts`

**Interfaces:**
- Consumes: `users` da `lib/db/schema/users.ts` (Task 3).
- Produces: `categories` (tabella), `DEFAULT_CATEGORIES` (array di seed) — usati da `lib/db/seed.ts` (Task 9) e da `transactions`/`budgets` (Task 6-7) come target della FK `category_id`.

- [ ] **Step 1: Creare `lib/db/schema/categories.ts`**

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

- [ ] **Step 2: Verificare che il file compili**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Commit (manuale — l'agente non esegue git in questo repo)**

```bash
git add lib/db/schema/categories.ts
git commit -m "feat: add categories table schema with default seed list"
```

---

### Task 5: Enum condiviso + schema `accounts`

**Files:**
- Create: `lib/db/schema/shared.ts`
- Create: `lib/db/schema/accounts.ts`

**Interfaces:**
- Consumes: `users` (Task 3).
- Produces: `dataSourceEnum` (usato anche da `transactions`, Task 6), `accounts` (tabella), tipi `Account`/`NewAccount` — usati da `transactions` (Task 6) come target della FK `account_id`.

- [ ] **Step 1: Creare `lib/db/schema/shared.ts`**

```ts
import { pgEnum } from "drizzle-orm/pg-core";

export const dataSourceEnum = pgEnum("data_source", ["manuale", "auto"]);
```

- [ ] **Step 2: Creare `lib/db/schema/accounts.ts`**

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

- [ ] **Step 3: Verificare che il file compili**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 4: Commit (manuale — l'agente non esegue git in questo repo)**

```bash
git add lib/db/schema/shared.ts lib/db/schema/accounts.ts
git commit -m "feat: add accounts table schema"
```

---

### Task 6: Schema `transactions` + validazione `excluded_amount` (TDD)

**Files:**
- Create: `lib/db/schema/transactions.ts`
- Test: `lib/db/schema/transactions.test.ts`

**Interfaces:**
- Consumes: `users` (Task 3), `accounts`+`dataSourceEnum` (Task 5), `categories` (Task 4).
- Produces: `transactions` (tabella), tipi `Transaction`/`NewTransaction`, `isValidExcludedAmount(amount: number, excludedAmount: number): boolean` — quest'ultima è la funzione che il piano/spec della schermata Spese (futuro) userà per validare il meccanismo "Dividi" prima di scrivere su DB.

- [ ] **Step 1: Scrivere il test (fallirà: il modulo non esiste ancora)**

Crea `lib/db/schema/transactions.test.ts`:

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

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `pnpm test transactions.test.ts`
Expected: FAIL — errore di risoluzione modulo (`lib/db/schema/transactions.ts` non esiste).

- [ ] **Step 3: Creare `lib/db/schema/transactions.ts`**

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
 * Verifica l'invariante del meccanismo "Dividi": la quota esclusa deve avere
 * lo stesso segno dell'importo (o essere zero) e valore assoluto non superiore.
 * Validazione solo applicativa, nessun CHECK constraint DB (per decisione di spec).
 */
export function isValidExcludedAmount(amount: number, excludedAmount: number): boolean {
  if (excludedAmount !== 0 && Math.sign(excludedAmount) !== Math.sign(amount)) {
    return false;
  }
  return Math.abs(excludedAmount) <= Math.abs(amount);
}
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

Run: `pnpm test transactions.test.ts`
Expected: PASS, 4 test superati.

- [ ] **Step 5: Verificare che l'intero progetto compili**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 6: Commit (manuale — l'agente non esegue git in questo repo)**

```bash
git add lib/db/schema/transactions.ts lib/db/schema/transactions.test.ts
git commit -m "feat: add transactions table schema with excluded-amount validation"
```

---

### Task 7: Schema `budgets`, barrel, client Drizzle

**Files:**
- Create: `lib/db/schema/budgets.ts`
- Create: `lib/db/schema/index.ts`
- Create: `lib/db/client.ts`

**Interfaces:**
- Consumes: `users` (Task 3), `categories` (Task 4), tutte le tabelle precedenti (per il barrel).
- Produces: `budgets` (tabella), tipi `Budget`/`NewBudget`; `lib/db/schema/index.ts` come unico punto di import per lo schema (usato da `drizzle.config.ts`, Task 2, e da tutti i task successivi); `db` (istanza Drizzle) e `client` (connessione postgres.js raw) da `lib/db/client.ts` — usati da `lib/db/migrate.ts` (Task 8), `lib/db/seed.ts` (Task 9), `lib/db/integration.test.ts` (Task 10).

- [ ] **Step 1: Creare `lib/db/schema/budgets.ts`**

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

- [ ] **Step 2: Creare il barrel `lib/db/schema/index.ts`**

```ts
export * from "./shared";
export * from "./users";
export * from "./categories";
export * from "./accounts";
export * from "./transactions";
export * from "./budgets";
```

- [ ] **Step 3: Creare `lib/db/client.ts`**

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

- [ ] **Step 4: Verificare che il progetto compili**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 5: Commit (manuale — l'agente non esegue git in questo repo)**

```bash
git add lib/db/schema/budgets.ts lib/db/schema/index.ts lib/db/client.ts
git commit -m "feat: add budgets table schema, schema barrel, and Drizzle client"
```

---

### Task 8: Generare e applicare la migration su Neon

**Files:**
- Create: `lib/db/migrations/` (generato da `drizzle-kit generate`, contenuto esatto non prevedibile in anticipo)
- Create: `lib/db/migrate.ts`

**Interfaces:**
- Consumes: `lib/db/schema/index.ts` (Task 7), `DATABASE_URL` (Task 1).
- Produces: le 5 tabelle create realmente sul Postgres Neon di sviluppo — precondizione per `lib/db/seed.ts` (Task 9) e `lib/db/integration.test.ts` (Task 10).

- [ ] **Step 1: Generare i file di migration dallo schema**

Run: `pnpm db:generate`
Expected: output che conferma la creazione di un file SQL sotto `lib/db/migrations/` (es. `0000_<nome_casuale>.sql`), con 5 statement `CREATE TABLE` (`users`, `categories`, `accounts`, `transactions`, `budgets`) più i tipi enum.

- [ ] **Step 2: Creare `lib/db/migrate.ts`**

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

- [ ] **Step 3: Applicare la migration a Neon e verificare che le tabelle esistano davvero**

Run: `pnpm db:migrate`
Expected: stampa `Tabelle presenti: [ 'accounts', 'budgets', 'categories', 'transactions', 'users' ]` seguito da `Migration completate.`, senza errori.

- [ ] **Step 4: Commit (manuale — l'agente non esegue git in questo repo)**

```bash
git add lib/db/migrations lib/db/migrate.ts
git commit -m "feat: generate and apply initial database migration"
```

---

### Task 9: Script di seed (utente dev + categorie)

**Files:**
- Create: `lib/db/seed.ts`

**Interfaces:**
- Consumes: `db`, `client` (Task 7), `users`, `categories`, `DEFAULT_CATEGORIES` (Task 3-4), tabelle reali su Neon (Task 8).
- Produces: una riga `users` e 8 righe `categories` reali su Neon — precondizione utile (non obbligatoria) per `lib/db/integration.test.ts` (Task 10), che comunque crea il proprio utente di test indipendente.

- [ ] **Step 1: Creare `lib/db/seed.ts`**

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

- [ ] **Step 2: Eseguire il seed e verificare l'esito**

Run: `pnpm db:seed`
Expected: output `Utente dev creato: <uuid>` seguito da `Categorie create: 8`, senza errori.

- [ ] **Step 3: Commit (manuale — l'agente non esegue git in questo repo)**

```bash
git add lib/db/seed.ts
git commit -m "feat: add dev seed script for a user and default categories"
```

---

### Task 10: Test di integrazione end-to-end

**Files:**
- Test: `lib/db/integration.test.ts`

**Interfaces:**
- Consumes: `db`, `users`, `categories`, `accounts`, `transactions`, `budgets`, `isValidExcludedAmount` (tutti i task precedenti).
- Produces: nessuna nuova interfaccia — è la verifica finale che l'intero schema funziona insieme contro un Postgres reale.

- [ ] **Step 1: Scrivere il test**

Questo test non segue lo schema "rosso poi verde": lo schema e il client sono già stati implementati nei Task 3-7, quindi non c'è codice di produzione mancante da scrivere dopo. Il suo scopo è verificare che tutti i pezzi funzionino insieme contro un Postgres reale (compreso il comportamento `onDelete: cascade`), non guidare una nuova implementazione.

Crea `lib/db/integration.test.ts`:

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

- [ ] **Step 2: Eseguire il test e verificare che passi**

Run: `pnpm test integration.test.ts`
Expected: PASS, 2 test superati, nessun errore di connessione a Neon.

- [ ] **Step 3: Eseguire l'intera suite di test del progetto**

Run: `pnpm test`
Expected: PASS, tutti i test (unit `transactions.test.ts` + integration `integration.test.ts`) superati.

- [ ] **Step 4: Commit (manuale — l'agente non esegue git in questo repo)**

```bash
git add lib/db/integration.test.ts
git commit -m "test: add end-to-end integration test for the base data model"
```

---

## Fuori scope di questo piano (rimandato consapevolmente, vedi anche lo spec)

- **UI, API, autenticazione vera**: questo piano produce solo lo schema dati.
- **Storicizzazione budget per mese, categorie personalizzabili, multi-valuta per riga**: fuori scope come da spec.
- **CHECK constraint DB per `excluded_amount`**: solo validazione applicativa (`isValidExcludedAmount`) per ora.
- **Wiring della validazione negli insert/update reali**: `isValidExcludedAmount` è esportata e testata, ma non ancora usata da un layer di servizio/API (non esiste ancora) — sarà responsabilità dello spec della schermata Spese.
- **Deploy in produzione**: il piano infra (`docs/superpowers/plans/2026-07-03-infra-foundation.md`) resta in pausa; Neon qui è usato solo per lo sviluppo.
